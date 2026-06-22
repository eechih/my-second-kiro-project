import type { Schema } from "../../data/resource";
import type { OrderFulfillmentStatus } from "@shared/models/order";
import { isOrderFulfillmentStatus } from "@shared/models/order";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { buildOrderSummaryTransactItems } from "../order-summary-sync";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "cancelReceived";

/**
 * 撤銷入庫確認 Lambda 函式
 *
 * 接受 orderId，將 Order 狀態從 RECEIVED 回退為 ORDERED，
 * 並在同一交易中扣減 Product 庫存（撤銷入庫時增加的庫存）。
 *
 * DynamoDB TransactWriteItems 交易項目：
 * 1. 更新 Order：status → ORDERED、REMOVE receivedAt、append statusHistory
 * 2. 扣減 Product.stockQuantity（以 order.quantity 為扣減量）
 *
 * 需求：2.5, 3.8
 */
export const handler: Schema["cancelReceived"]["functionHandler"] = async (
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
    const rawStatus = order["status"];
    const status: OrderFulfillmentStatus = isOrderFulfillmentStatus(rawStatus)
      ? rawStatus
      : "PENDING";
    const productId = String(order["productId"] ?? "");
    const quantity = Number(order["quantity"] ?? 0);

    logDebug(FUNCTION_NAME, "order loaded", {
      orderId,
      status,
      rawStatus,
      productId,
      quantity,
    });

    // 2. 驗證狀態：僅 RECEIVED 可撤銷回 ORDERED
    if (status !== "RECEIVED") {
      logWarn(FUNCTION_NAME, "invalid order status for cancel received", {
        orderId,
        status,
      });
      return JSON.stringify({
        success: false,
        message: "僅已到貨的訂單可取消到貨",
      });
    }

    if (!productId) {
      return JSON.stringify({
        success: false,
        message: "訂單缺少商品資料，無法取消到貨",
      });
    }

    // 3. 準備交易
    const now = new Date().toISOString();
    const nextOrder = {
      ...order,
      status: "ORDERED",
      receivedAt: null,
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
    const existingHistory = Array.isArray(order["statusHistory"])
      ? (order["statusHistory"] as Record<string, unknown>[])
      : [];
    const updatedHistory = [
      ...existingHistory,
      {
        fromStatus: "RECEIVED",
        toStatus: "ORDERED",
        changedAt: now,
      },
    ];

    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      productId,
      quantity,
      fromStatus: "RECEIVED",
      toStatus: "ORDERED",
    });

    // 4. DynamoDB Transaction
    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          // 4a. 更新 Order：status → ORDERED、REMOVE receivedAt、append statusHistory
          {
            Update: {
              TableName: orderTable,
              Key: marshall({ id: orderId }),
              UpdateExpression:
                "SET #st = :ordered, statusHistory = :history, updatedAt = :now REMOVE receivedAt",
              ConditionExpression: "#st = :received",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":ordered": "ORDERED",
                ":received": "RECEIVED",
                ":history": updatedHistory,
                ":now": now,
              }),
            },
          },
          // 4b. 扣減 Product 庫存
          {
            Update: {
              TableName: productTable,
              Key: marshall({ id: productId }),
              UpdateExpression:
                "SET stockQuantity = stockQuantity - :qty, updatedAt = :now",
              ConditionExpression:
                "attribute_exists(id) AND stockQuantity >= :qty",
              ExpressionAttributeValues: marshall({
                ":qty": quantity,
                ":now": now,
              }),
            },
          },
          ...summaryItems,
        ],
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      productId,
      quantity,
      orderStatus: "ORDERED",
    });

    return JSON.stringify({
      success: true,
      message: "取消到貨成功",
      data: {
        orderId,
        productId,
        quantity,
        orderStatus: "ORDERED",
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
        message: "取消到貨失敗，庫存不足或資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderId });
    return JSON.stringify({
      success: false,
      message: `取消到貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
