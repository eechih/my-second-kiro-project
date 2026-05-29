import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  normalizeOrderItemStatus,
  normalizeOrderStatus,
  type OrderItemStatus,
} from "@shared/models/order";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "cancelOutOfStock";

function restoreStatus(orderItem: Record<string, unknown>): OrderItemStatus {
  if (orderItem["receivedAt"]) {
    return "received";
  }
  if (orderItem["purchasedAt"]) {
    return "ordered";
  }
  return "pending";
}

/**
 * 取消缺貨 Lambda 函式
 *
 * 將 out_of_stock 明細恢復到原本流程狀態：
 * - 有 receivedAt 則回 received
 * - 否則有 purchasedAt 則回 ordered
 * - 否則回 pending
 *
 * orderId 從 OrderItem 記錄中讀取，前端只需傳 orderItemId。
 */
export const handler: Schema["cancelOutOfStock"]["functionHandler"] = async (
  event,
) => {
  const { orderItemId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderItemId });

  const orderItemTable = process.env["ORDER_ITEM_TABLE_NAME"];
  const orderTable = process.env["ORDER_TABLE_NAME"];

  if (!orderItemTable || !orderTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderItemTable: !!orderItemTable,
      hasOrderTable: !!orderTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 OrderItem 資料（含 orderId）
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
    const orderId = String(orderItem["orderId"] ?? "");
    logDebug(FUNCTION_NAME, "order item loaded", {
      orderItemId,
      orderId,
      status,
      rawStatus: orderItem["status"],
      hasPurchasedAt: !!orderItem["purchasedAt"],
      hasReceivedAt: !!orderItem["receivedAt"],
    });

    if (!orderId) {
      return JSON.stringify({
        success: false,
        message: "明細項目缺少訂單關聯",
      });
    }

    // 2. 驗證訂單狀態
    const orderResult = await ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
      }),
    );

    if (!orderResult.Item) {
      logWarn(FUNCTION_NAME, "order not found", { orderId, orderItemId });
      return JSON.stringify({ success: false, message: "找不到指定的訂單" });
    }

    const order = unmarshall(orderResult.Item);
    if (normalizeOrderStatus(order["status"]) === "CANCELLED") {
      return JSON.stringify({
        success: false,
        message: "已取消訂單不可取消缺貨",
      });
    }

    // 3. 驗證明細狀態
    if (status !== "out_of_stock") {
      return JSON.stringify({
        success: false,
        message: "僅缺貨明細可取消缺貨",
      });
    }

    const nextStatus = restoreStatus(orderItem);
    const now = new Date().toISOString();

    // 4. 執行交易
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderItemId,
      orderId,
      previousStatus: status,
      nextStatus,
      transactItemCount: 1,
    });
    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: orderItemTable,
              Key: marshall({ id: orderItemId }),
              UpdateExpression:
                "SET #st = :nextStatus, updatedAt = :now REMOVE outOfStockAt",
              ConditionExpression:
                "orderId = :orderId AND (#st = :outOfStock OR #st = :legacyOutOfStock)",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":orderId": orderId,
                ":outOfStock": "out_of_stock",
                ":legacyOutOfStock": "缺貨",
                ":nextStatus": nextStatus,
                ":now": now,
              }),
            },
          },
        ],
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderItemId,
      orderId,
      orderItemStatus: nextStatus,
    });
    return JSON.stringify({
      success: true,
      message: "取消缺貨成功",
      data: {
        orderItemId,
        orderItemStatus: nextStatus,
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
        message: "取消缺貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderItemId });
    return JSON.stringify({
      success: false,
      message: `取消缺貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
