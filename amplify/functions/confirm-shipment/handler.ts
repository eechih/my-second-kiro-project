import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidOrderStatusTransition } from "@shared/logic/order-status";
import type { OrderFulfillmentStatus } from "@shared/models/order";
import { isOrderFulfillmentStatus } from "@shared/models/order";
import type { Schema } from "../../data/resource";
import { buildOrderSummaryTransactItems } from "../order-summary-sync";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmShipment";

/**
 * 單筆直接出貨 Lambda 函式
 *
 * 接受 orderId，驗證 Order 狀態為 RECEIVED，
 * 在 DynamoDB 交易中將 Order 狀態更新為 SHIPPED 並扣減商品庫存。
 */
export const handler: Schema["confirmShipment"]["functionHandler"] = async (
  event,
) => {
  const { orderId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderId });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];
  const customerSummaryTable =
    process.env["CUSTOMER_ORDER_SUMMARY_TABLE_NAME"];
  const productSummaryTable = process.env["PRODUCT_ORDER_SUMMARY_TABLE_NAME"];
  const supplierSummaryTable =
    process.env["SUPPLIER_ORDER_SUMMARY_TABLE_NAME"];

  if (
    !orderTable ||
    !productTable ||
    !customerSummaryTable ||
    !productSummaryTable ||
    !supplierSummaryTable
  ) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasProductTable: !!productTable,
      hasCustomerSummaryTable: !!customerSummaryTable,
      hasProductSummaryTable: !!productSummaryTable,
      hasSupplierSummaryTable: !!supplierSummaryTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 讀取 Order 資料
    const orderResult = await ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
      }),
    );

    if (!orderResult.Item) {
      logWarn(FUNCTION_NAME, "order not found", { orderId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的訂單",
      });
    }

    const order = unmarshall(orderResult.Item);
    const currentStatus = order["status"] as string;
    const quantity = order["quantity"] as number;
    const productId = order["productId"] as string;

    logDebug(FUNCTION_NAME, "order loaded", {
      orderId,
      currentStatus,
      quantity,
      productId,
    });

    // 2. 驗證 Order 狀態轉換是否合法（RECEIVED → SHIPPED）
    if (
      !isOrderFulfillmentStatus(currentStatus) ||
      !isValidOrderStatusTransition(
        currentStatus as OrderFulfillmentStatus,
        "SHIPPED",
      )
    ) {
      logWarn(FUNCTION_NAME, "invalid order status transition", {
        orderId,
        currentStatus,
        targetStatus: "SHIPPED",
      });
      return JSON.stringify({
        success: false,
        message: `訂單目前狀態為「${currentStatus}」，無法執行出貨操作`,
      });
    }

    // 3. 讀取 Product 資料
    const productResult = await ddb.send(
      new GetItemCommand({
        TableName: productTable,
        Key: marshall({ id: productId }),
      }),
    );

    if (!productResult.Item) {
      logWarn(FUNCTION_NAME, "product not found", { orderId, productId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的商品",
      });
    }

    const product = unmarshall(productResult.Item);
    const stockQuantity = product["stockQuantity"] as number;

    logDebug(FUNCTION_NAME, "product loaded", {
      orderId,
      productId,
      stockQuantity,
      requestedQuantity: quantity,
    });

    // 4. 驗證庫存是否充足
    if (stockQuantity < quantity) {
      logWarn(FUNCTION_NAME, "insufficient stock", {
        orderId,
        productId,
        quantity,
        stockQuantity,
      });
      return JSON.stringify({
        success: false,
        message: `庫存不足，無法出貨：需要 ${quantity}，目前庫存 ${stockQuantity}`,
      });
    }

    // 5. 建立交易：更新 Order 狀態 + 扣減 Product 庫存
    const now = new Date().toISOString();
    const nextOrder = {
      ...order,
      status: "SHIPPED",
      shippedAt: now,
      updatedAt: now,
    };
    const summaryItems = await buildOrderSummaryTransactItems({
      ddb,
      tables: {
        orderTable,
        customerSummaryTable,
        productSummaryTable,
        supplierSummaryTable,
      },
      changes: [{ before: order, after: nextOrder }],
      now,
    });
    const existingHistory =
      (order["statusHistory"] as Record<string, unknown>[]) ?? [];
    const newHistoryEntry = {
      fromStatus: "RECEIVED",
      toStatus: "SHIPPED",
      changedAt: now,
    };
    const updatedHistory = [...existingHistory, newHistoryEntry];

    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 5a. 更新 Order：status → SHIPPED, shippedAt, statusHistory
    transactItems.push({
      Update: {
        TableName: orderTable,
        Key: marshall({ id: orderId }),
        UpdateExpression:
          "SET #st = :newStatus, shippedAt = :now, statusHistory = :history, updatedAt = :now",
        ConditionExpression: "#st = :received",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":newStatus": "SHIPPED",
          ":received": "RECEIVED",
          ":now": now,
          ":history": updatedHistory,
        }),
      },
    });

    // 5b. 扣減 Product 庫存
    transactItems.push({
      Update: {
        TableName: productTable,
        Key: marshall({ id: productId }),
        UpdateExpression:
          "SET stockQuantity = stockQuantity - :qty, updatedAt = :now",
        ConditionExpression: "attribute_exists(id) AND stockQuantity >= :qty",
        ExpressionAttributeValues: marshall({
          ":qty": quantity,
          ":now": now,
        }),
      },
    });

    transactItems.push(...summaryItems);

    // 6. 執行交易
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      productId,
      quantity,
      transactItemCount: transactItems.length,
    });

    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      productId,
      quantity,
      orderStatus: "SHIPPED",
    });

    return JSON.stringify({
      success: true,
      message: "出貨操作成功",
      data: {
        orderId,
        productId,
        quantity,
        orderStatus: "SHIPPED",
        shippedAt: now,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        orderId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "出貨操作失敗：庫存不足或資料已變更，請重新取得最新資料後重試",
      });
    }
    logError(FUNCTION_NAME, "handler failed", error, { orderId });
    return JSON.stringify({
      success: false,
      message: `出貨操作失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
