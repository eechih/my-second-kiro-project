import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  deriveFulfillmentStatusFromOrderItems,
  deriveOrderStatusFromSummary,
} from "@shared/logic/order-status";
import { validateProcurementReceive } from "@shared/logic/procurement";
import {
  normalizeFulfillmentStatus,
  normalizeOrderItemStatus,
  normalizeOrderStatus,
  normalizePaymentStatus,
} from "@shared/models/order";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";
import {
  buildShipmentSummaryDelta,
  buildShipmentSummaryTransactItem,
} from "../customer-fulfillment-summary";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmReceived";

/**
 * 入庫確認操作 Lambda 函式（簡化版）
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 更新 OrderItem 狀態為「已收到」並記錄 receivedAt
 * - 增加 Product 的 stockQuantity（庫存統一在商品層級管理）
 *
 * 不再查詢 PurchaseRecord 表，直接從 OrderItem 讀取 status 判斷是否可入庫。
 *
 * 包含驗證邏輯：
 * - OrderItem status 必須為「已訂購」（使用 validateProcurementReceive 共用驗證）
 * - 庫存更新使用 DynamoDB 原子操作，避免前端維護版本欄位
 *
 * 需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export const handler: Schema["confirmReceived"]["functionHandler"] = async (
  event,
) => {
  const { orderItemId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderItemId });

  const orderItemTable = process.env["ORDER_ITEM_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];
  const orderTable = process.env["ORDER_TABLE_NAME"];
  const summaryTable = process.env["CUSTOMER_FULFILLMENT_SUMMARY_TABLE_NAME"];

  if (!orderItemTable || !productTable || !orderTable || !summaryTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderItemTable: !!orderItemTable,
      hasProductTable: !!productTable,
      hasOrderTable: !!orderTable,
      hasSummaryTable: !!summaryTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 OrderItem 資料
    const orderItemResult = await ddb.send(
      new GetItemCommand({
        TableName: orderItemTable,
        Key: marshall({ id: orderItemId }),
      }),
    );

    if (!orderItemResult.Item) {
      logWarn(FUNCTION_NAME, "order item not found", { orderItemId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的明細項目",
      });
    }

    const orderItem = unmarshall(orderItemResult.Item);
    const status = normalizeOrderItemStatus(orderItem["status"]);
    const quantity = orderItem["quantity"] as number;
    const productId = orderItem["productId"] as string;
    const orderId = String(orderItem["orderId"] ?? "");
    logDebug(FUNCTION_NAME, "order item loaded", {
      orderItemId,
      orderId,
      productId,
      status,
      quantity,
      rawStatus: orderItem["status"],
    });

    if (!orderId) {
      return JSON.stringify({
        success: false,
        message: "明細項目缺少訂單關聯",
      });
    }

    // 2. 使用共用驗證函式檢查前置條件
    const validation = validateProcurementReceive({ status });
    if (!validation.valid) {
      logWarn(FUNCTION_NAME, "validation failed", {
        orderItemId,
        productId,
        status,
        validationError: validation.error,
      });
      return JSON.stringify({
        success: false,
        message: validation.error,
      });
    }

    // 3. 取得庫存資訊（統一在商品層級管理）
    const productResult = await ddb.send(
      new GetItemCommand({
        TableName: productTable,
        Key: marshall({ id: productId }),
      }),
    );
    if (!productResult.Item) {
      logWarn(FUNCTION_NAME, "product not found", { orderItemId, productId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的商品",
      });
    }
    const product = unmarshall(productResult.Item);
    logDebug(FUNCTION_NAME, "product loaded", {
      orderItemId,
      productId,
      stockQuantity: product["stockQuantity"],
    });

    const now = new Date().toISOString();
    const orderResult = await ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
      }),
    );
    if (!orderResult.Item) {
      return JSON.stringify({
        success: false,
        message: "找不到指定的訂單",
      });
    }
    const order = unmarshall(orderResult.Item);
    const currentOrderStatus = normalizeOrderStatus(order["status"]);
    const currentPaymentStatus = normalizePaymentStatus(order["paymentStatus"]);
    const currentFulfillmentStatus = normalizeFulfillmentStatus(
      order["fulfillmentStatus"],
    );
    const customerId = String(order["customerId"] ?? "");
    const customerNameSnapshot = String(
      order["customerNameSnapshot"] ?? "未命名客戶",
    );

    if (!customerId) {
      return JSON.stringify({
        success: false,
        message: "訂單缺少客戶關聯，無法更新出貨摘要",
      });
    }

    const allOrderItemsResult = await ddb.send(
      new QueryCommand({
        TableName: orderItemTable,
        IndexName: "byOrderId",
        KeyConditionExpression: "orderId = :orderId",
        ExpressionAttributeValues: marshall({ ":orderId": orderId }),
      }),
    );
    const allOrderItems = (allOrderItemsResult.Items ?? []).map((rawItem) =>
      unmarshall(rawItem),
    );
    const simulatedOrderItems = allOrderItems.map((li) => ({
      status:
        li["id"] === orderItemId
          ? ("received" as const)
          : normalizeOrderItemStatus(li["status"]),
    }));
    const derivedFulfillmentStatus =
      deriveFulfillmentStatusFromOrderItems(simulatedOrderItems);
    const derivedOrderStatus = deriveOrderStatusFromSummary({
      paymentStatus: currentPaymentStatus,
      fulfillmentStatus: derivedFulfillmentStatus,
      cancelledAt: order["cancelledAt"] != null ? String(order["cancelledAt"]) : null,
    });
    const summaryResult = await ddb.send(
      new GetItemCommand({
        TableName: summaryTable,
        Key: marshall({ id: customerId }),
      }),
    );
    const summaryDelta = buildShipmentSummaryDelta({
      allOrderItems: allOrderItems.map((li) => ({
        id: String(li["id"] ?? ""),
        status: normalizeOrderItemStatus(li["status"]) as
          | "ordered"
          | "received"
          | "shipped",
      })),
      fromStatus: "ordered",
      fromOrderStatus: currentOrderStatus,
      orderItemId,
      quantity,
      toOrderStatus: derivedOrderStatus,
      toStatus: "received",
    });

    // 4. 建立交易項目（僅 2 個操作：OrderItem 更新 + 庫存更新）
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 4a. 更新 OrderItem：status → "received"、receivedAt
    transactItems.push({
      Update: {
        TableName: orderItemTable,
        Key: marshall({ id: orderItemId }),
        UpdateExpression:
          "SET #st = :newStatus, receivedAt = :now, updatedAt = :now",
        ConditionExpression:
          "#st = :expectedStatus OR #st = :legacyExpectedStatus",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":newStatus": "received",
          ":expectedStatus": "ordered",
          ":legacyExpectedStatus": "已訂購",
          ":now": now,
        }),
      },
    });

    if (
      derivedFulfillmentStatus !== currentFulfillmentStatus ||
      derivedOrderStatus !== currentOrderStatus
    ) {
      const existingHistory =
        Array.isArray(order["statusHistory"])
          ? (order["statusHistory"] as Record<string, unknown>[])
          : [];
      const updatedHistory =
        derivedOrderStatus !== currentOrderStatus
          ? [
              ...existingHistory,
              {
                fromStatus: currentOrderStatus,
                toStatus: derivedOrderStatus,
                changedAt: now,
              },
            ]
          : existingHistory;

      transactItems.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ id: orderId }),
          UpdateExpression:
            "SET #st = :newStatus, fulfillmentStatus = :fulfillmentStatus, statusHistory = :history, updatedAt = :now",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":newStatus": derivedOrderStatus,
            ":fulfillmentStatus": derivedFulfillmentStatus,
            ":history": updatedHistory,
            ":now": now,
          }),
        },
      });
    }

    const summaryTransactItem = buildShipmentSummaryTransactItem({
      customerId,
      customerNameSnapshot,
      now,
      summaryResult,
      summaryTableName: summaryTable,
      delta: summaryDelta,
    });
    if (summaryTransactItem) {
      transactItems.push(summaryTransactItem);
    }

    // 4b. 增加庫存（商品層級）
    transactItems.push({
      Update: {
        TableName: productTable,
        Key: marshall({ id: productId }),
        UpdateExpression:
          "SET stockQuantity = stockQuantity + :qty, updatedAt = :now",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeValues: marshall({
          ":qty": quantity,
          ":now": now,
        }),
      },
    });

    // 5. 執行交易
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderItemId,
      orderId,
      productId,
      quantity,
      currentOrderStatus,
      currentFulfillmentStatus,
      derivedOrderStatus,
      derivedFulfillmentStatus,
      transactItemCount: transactItems.length,
    });
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderItemId,
      orderId,
      productId,
      quantity,
      orderItemStatus: "received",
      orderStatus: derivedOrderStatus,
      fulfillmentStatus: derivedFulfillmentStatus,
    });
    return JSON.stringify({
      success: true,
      message: "入庫確認成功",
      data: {
        orderItemId,
        quantity,
        orderItemStatus: "received",
        orderStatus: derivedOrderStatus,
        fulfillmentStatus: derivedFulfillmentStatus,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        orderItemId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "入庫確認失敗，請重新取得最新資料後重試",
      });
    }
    logError(FUNCTION_NAME, "handler failed", error, { orderItemId });
    return JSON.stringify({
      success: false,
      message: `入庫確認失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
