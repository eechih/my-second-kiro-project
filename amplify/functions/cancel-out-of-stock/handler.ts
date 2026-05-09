import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  normalizeLineItemStatus,
  normalizeOrderStatus,
  type LineItemStatus,
} from "@shared/models/order";

const ddb = new DynamoDBClient({});

function restoreStatus(lineItem: Record<string, unknown>): LineItemStatus {
  if (lineItem["receivedAt"]) {
    return "received";
  }

  if (lineItem["purchasedAt"]) {
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
 */
export const handler: Schema["cancelOutOfStock"]["functionHandler"] = async (
  event,
) => {
  const { orderId, lineItemId } = event.arguments;

  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const orderTable = process.env["ORDER_TABLE_NAME"];

  if (!lineItemTable || !orderTable) {
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    const [orderResult, lineItemResult] = await Promise.all([
      ddb.send(
        new GetItemCommand({
          TableName: orderTable,
          Key: marshall({ id: orderId }),
        }),
      ),
      ddb.send(
        new GetItemCommand({
          TableName: lineItemTable,
          Key: marshall({ id: lineItemId }),
        }),
      ),
    ]);

    if (!orderResult.Item) {
      return JSON.stringify({
        success: false,
        message: "找不到指定的訂單",
      });
    }

    if (!lineItemResult.Item) {
      return JSON.stringify({
        success: false,
        message: "找不到指定的明細項目",
      });
    }

    const order = unmarshall(orderResult.Item);
    if (normalizeOrderStatus(order["status"]) === "cancelled") {
      return JSON.stringify({
        success: false,
        message: "已取消訂單不可取消缺貨",
      });
    }

    const lineItem = unmarshall(lineItemResult.Item);
    const status = normalizeLineItemStatus(lineItem["status"]);
    const lineItemOrderId = String(lineItem["orderId"] ?? "");

    if (lineItemOrderId !== orderId) {
      return JSON.stringify({
        success: false,
        message: "明細項目不屬於指定訂單",
      });
    }

    if (status !== "out_of_stock") {
      return JSON.stringify({
        success: false,
        message: "僅缺貨明細可取消缺貨",
      });
    }

    const nextStatus = restoreStatus(lineItem);
    const now = new Date().toISOString();

    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: lineItemTable,
              Key: marshall({ id: lineItemId }),
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

    return JSON.stringify({
      success: true,
      message: "取消缺貨成功",
      data: {
        lineItemId,
        lineItemStatus: nextStatus,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message: "取消缺貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    console.error("cancelOutOfStock error:", error);
    return JSON.stringify({
      success: false,
      message: `取消缺貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
