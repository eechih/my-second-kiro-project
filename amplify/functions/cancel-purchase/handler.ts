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
} from "@shared/models/order";
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
 * 將 ordered 明細恢復為 pending，並清除採購時間、數量、供應商與成本資料。
 */
export const handler: Schema["cancelPurchase"]["functionHandler"] = async (
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
    const orderId = String(orderItem["orderId"] ?? "");
    const status = normalizeOrderItemStatus(orderItem["status"]);
    logDebug(FUNCTION_NAME, "order item loaded", {
      orderId,
      orderItemId,
      status,
      rawStatus: orderItem["status"],
    });

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
    if (normalizeOrderStatus(order["status"]) === "cancelled") {
      return JSON.stringify({
        success: false,
        message: "已取消訂單不可取消採購",
      });
    }

    if (status !== "ordered") {
      return JSON.stringify({
        success: false,
        message: "僅已訂購明細可取消採購",
      });
    }

    const now = new Date().toISOString();

    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      orderItemId,
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
                "SET #st = :pending, updatedAt = :now REMOVE purchasedAt, supplierName, unitCostSnapshot, totalCostSnapshot",
              ConditionExpression:
                "orderId = :orderId AND (#st = :ordered OR #st = :legacyOrdered)",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":orderId": orderId,
                ":ordered": "ordered",
                ":legacyOrdered": "已訂購",
                ":pending": "pending",
                ":now": now,
              }),
            },
          },
        ],
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      orderItemId,
      orderItemStatus: "pending",
    });
    return JSON.stringify({
      success: true,
      message: "取消採購成功",
      data: {
        orderItemId,
        orderItemStatus: "pending",
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
        message: "取消採購失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderItemId });
    return JSON.stringify({
      success: false,
      message: `取消採購失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
