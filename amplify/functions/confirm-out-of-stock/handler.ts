import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidOrderStatusTransition } from "@shared/logic/order-status";
import type { OrderFulfillmentStatus } from "@shared/models/order";
import { isOrderFulfillmentStatus } from "@shared/models/order";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmOutOfStock";

/**
 * 確認缺貨 Lambda 函式
 *
 * 將 Order 的 status 從 PENDING 或 ORDERED 轉換為 OUT_OF_STOCK，
 * 記錄 outOfStockAt，並附加 statusHistory 記錄。
 *
 * 需求：2.5, 3.6, 3.9
 */
export const handler: Schema["confirmOutOfStock"]["functionHandler"] = async (
  event,
) => {
  const { orderId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderId });

  const orderTable = process.env["ORDER_TABLE_NAME"];

  if (!orderTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
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
        message: "訂單狀態無法識別，無法確認缺貨",
      });
    }

    const currentStatus: OrderFulfillmentStatus = rawStatus;
    const targetStatus: OrderFulfillmentStatus = "OUT_OF_STOCK";

    // 3. 使用共用邏輯驗證狀態轉換合法性（PENDING → OUT_OF_STOCK 或 ORDERED → OUT_OF_STOCK）
    if (!isValidOrderStatusTransition(currentStatus, targetStatus)) {
      logWarn(FUNCTION_NAME, "invalid status transition", {
        orderId,
        currentStatus,
        targetStatus,
      });
      return JSON.stringify({
        success: false,
        message: `無法從「${currentStatus}」狀態確認缺貨，僅「PENDING」或「ORDERED」狀態可確認缺貨`,
      });
    }

    const now = new Date().toISOString();

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

    // 5. 執行交易：status → OUT_OF_STOCK + outOfStockAt + statusHistory
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
                "SET #st = :newStatus, outOfStockAt = :now, statusHistory = :history, updatedAt = :now",
              ConditionExpression: "#st = :expectedStatus",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":newStatus": targetStatus,
                ":expectedStatus": currentStatus,
                ":now": now,
                ":history": updatedHistory,
              }),
            },
          },
        ],
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      status: targetStatus,
      outOfStockAt: now,
    });

    return JSON.stringify({
      success: true,
      message: "確認缺貨成功",
      data: {
        orderId,
        status: targetStatus,
        outOfStockAt: now,
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
        message: "確認缺貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderId });
    return JSON.stringify({
      success: false,
      message: `確認缺貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
