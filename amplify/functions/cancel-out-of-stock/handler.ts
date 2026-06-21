import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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
const FUNCTION_NAME = "cancelOutOfStock";

/**
 * 取消缺貨 Lambda 函式
 *
 * 將 Order 的 status 從 OUT_OF_STOCK 回退至先前狀態：
 * - 檢查 statusHistory 最後一筆的 fromStatus 作為回退目標
 * - 若無歷史記錄，預設回退至 PENDING
 * - 有效的回退目標為 PENDING 或 ORDERED（因為只有這兩個狀態可轉為 OUT_OF_STOCK）
 *
 * 需求：2.5, 3.8
 */
export const handler: Schema["cancelOutOfStock"]["functionHandler"] = async (
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
        message: "訂單狀態無法識別，無法取消缺貨",
      });
    }

    const currentStatus: OrderFulfillmentStatus = rawStatus;

    // 3. 驗證目前狀態為 OUT_OF_STOCK（僅缺貨狀態可取消缺貨）
    if (currentStatus !== "OUT_OF_STOCK") {
      logWarn(FUNCTION_NAME, "invalid status for cancel out of stock", {
        orderId,
        currentStatus,
      });
      return JSON.stringify({
        success: false,
        message: `無法從「${currentStatus}」狀態取消缺貨，僅「OUT_OF_STOCK」狀態可取消缺貨`,
      });
    }

    // 4. 決定回退目標狀態
    const existingHistory = Array.isArray(order["statusHistory"])
      ? (order["statusHistory"] as Record<string, unknown>[])
      : [];

    let restoreTarget: OrderFulfillmentStatus = "PENDING";

    if (existingHistory.length > 0) {
      const lastEntry = existingHistory[existingHistory.length - 1];
      const fromStatus = lastEntry?.["fromStatus"];
      if (
        isOrderFulfillmentStatus(fromStatus) &&
        (fromStatus === "PENDING" || fromStatus === "ORDERED")
      ) {
        restoreTarget = fromStatus;
      }
    }

    logDebug(FUNCTION_NAME, "restore target determined", {
      orderId,
      restoreTarget,
      historyLength: existingHistory.length,
    });

    const now = new Date().toISOString();

    // 5. 建立 statusHistory 記錄
    const updatedHistory = [
      ...existingHistory,
      {
        fromStatus: currentStatus,
        toStatus: restoreTarget,
        changedAt: now,
      },
    ];

    // 6. 執行交易：status → restoreTarget，清除 outOfStockAt，更新 statusHistory
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      currentStatus,
      restoreTarget,
    });

    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: orderTable,
              Key: marshall({ id: orderId }),
              UpdateExpression:
                "SET #st = :newStatus, statusHistory = :history, updatedAt = :now REMOVE outOfStockAt",
              ConditionExpression: "#st = :outOfStock",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":newStatus": restoreTarget,
                ":outOfStock": "OUT_OF_STOCK",
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
      status: restoreTarget,
    });

    return JSON.stringify({
      success: true,
      message: "取消缺貨成功",
      data: {
        orderId,
        status: restoreTarget,
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
        message: "取消缺貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderId });
    return JSON.stringify({
      success: false,
      message: `取消缺貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
