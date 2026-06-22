import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { OrderFulfillmentStatus } from "@shared/models/order";
import { isOrderFulfillmentStatus } from "@shared/models/order";
import { buildOrderSummaryTransactItems } from "../order-summary-sync";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "cancelPurchase";

/**
 * 取消採購 Lambda 函式
 *
 * 將 Order 的 status 從 ORDERED 回退為 PENDING，
 * 清除 purchasedAt，保留 supplierName，並附加 statusHistory 記錄。
 *
 * 注意：ORDERED→PENDING 為回退操作，不在正向狀態轉換表內，
 * 此處直接驗證目前狀態為 ORDERED 後手動回退。
 *
 * 需求：2.5, 3.8
 */
export const handler: Schema["cancelPurchase"]["functionHandler"] = async (
  event,
) => {
  const { orderId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderId });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const customerSummaryTable =
    process.env["CUSTOMER_ORDER_SUMMARY_TABLE_NAME"];
  const productSummaryTable = process.env["PRODUCT_ORDER_SUMMARY_TABLE_NAME"];
  const supplierSummaryTable =
    process.env["SUPPLIER_ORDER_SUMMARY_TABLE_NAME"];

  if (
    !orderTable ||
    !customerSummaryTable ||
    !productSummaryTable ||
    !supplierSummaryTable
  ) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
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
    // 1. 取得 Order 資料
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
    logDebug(FUNCTION_NAME, "order loaded", {
      orderId,
      rawStatus,
    });

    // 2. 驗證目前狀態是否為合法的 OrderFulfillmentStatus
    if (!isOrderFulfillmentStatus(rawStatus)) {
      logWarn(FUNCTION_NAME, "invalid order status", { orderId, rawStatus });
      return JSON.stringify({
        success: false,
        message: "訂單狀態無法識別，無法取消採購",
      });
    }

    const currentStatus: OrderFulfillmentStatus = rawStatus;
    const targetStatus: OrderFulfillmentStatus = "PENDING";

    // 3. 驗證目前狀態為 ORDERED（僅已採購狀態可取消採購回退至 PENDING）
    if (currentStatus !== "ORDERED") {
      logWarn(FUNCTION_NAME, "invalid status for cancel purchase", {
        orderId,
        currentStatus,
      });
      return JSON.stringify({
        success: false,
        message: `無法從「${currentStatus}」狀態取消採購，僅「ORDERED」狀態可取消採購`,
      });
    }

    const now = new Date().toISOString();
    const nextOrder = {
      ...order,
      status: targetStatus,
      purchasedAt: null,
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

    // 4. 建立 statusHistory 記錄
    const existingHistory = Array.isArray(order["statusHistory"])
      ? (order["statusHistory"] as Record<string, unknown>[])
      : [];
    const updatedHistory = [
      ...existingHistory,
      {
        fromStatus: currentStatus,
        toStatus: targetStatus,
        changedAt: now,
      },
    ];

    // 5. 執行交易：status → PENDING，清除 purchasedAt，更新 statusHistory
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      currentStatus,
      targetStatus,
    });

    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: orderTable,
              Key: marshall({ id: orderId }),
              UpdateExpression:
                "SET #st = :newStatus, statusHistory = :history, updatedAt = :now REMOVE purchasedAt",
              ConditionExpression: "#st = :ordered",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":newStatus": targetStatus,
                ":ordered": "ORDERED",
                ":now": now,
                ":history": updatedHistory,
              }),
            },
          },
          ...summaryItems,
        ],
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      status: targetStatus,
    });

    return JSON.stringify({
      success: true,
      message: "取消採購成功",
      data: {
        orderId,
        status: targetStatus,
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
        message: "取消採購失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderId });
    return JSON.stringify({
      success: false,
      message: `取消採購失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
