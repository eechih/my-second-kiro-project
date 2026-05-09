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
} from "@shared/models/order";

const ddb = new DynamoDBClient({});

/**
 * 取消採購 Lambda 函式
 *
 * 將 ordered 明細恢復為 pending，並清除採購時間、數量、供應商與成本資料。
 */
export const handler: Schema["cancelPurchase"]["functionHandler"] = async (
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
      return JSON.stringify({ success: false, message: "找不到指定的訂單" });
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
        message: "已取消訂單不可取消採購",
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

    if (status !== "ordered") {
      return JSON.stringify({
        success: false,
        message: "僅已訂購明細可取消採購",
      });
    }

    const now = new Date().toISOString();

    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: lineItemTable,
              Key: marshall({ id: lineItemId }),
              UpdateExpression:
                "SET #st = :pending, purchasedQuantity = :zero, updatedAt = :now REMOVE purchasedAt, supplierId, supplierName, unitCost",
              ConditionExpression:
                "orderId = :orderId AND (#st = :ordered OR #st = :legacyOrdered)",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":orderId": orderId,
                ":ordered": "ordered",
                ":legacyOrdered": "已訂購",
                ":pending": "pending",
                ":zero": 0,
                ":now": now,
              }),
            },
          },
        ],
      }),
    );

    return JSON.stringify({
      success: true,
      message: "取消採購成功",
      data: {
        lineItemId,
        lineItemStatus: "pending",
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message: "取消採購失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    console.error("cancelPurchase error:", error);
    return JSON.stringify({
      success: false,
      message: `取消採購失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
