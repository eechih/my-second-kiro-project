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
 * 確認缺貨 Lambda 函式
 *
 * 將可處理中的 LineItem 標記為 out_of_stock 並記錄 outOfStockAt。
 * 這是人工確認的異常狀態，不調整商品庫存。
 */
export const handler: Schema["confirmOutOfStock"]["functionHandler"] = async (
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
        message: "已取消訂單不可標記缺貨",
      });
    }

    const lineItem = unmarshall(lineItemResult.Item);
    const status = normalizeLineItemStatus(lineItem["status"]);
    const lineItemOrderId = String(lineItem["orderId"] ?? "");
    const shippedQuantity = Number(lineItem["shippedQuantity"] ?? 0);

    if (lineItemOrderId !== orderId) {
      return JSON.stringify({
        success: false,
        message: "明細項目不屬於指定訂單",
      });
    }

    if (shippedQuantity > 0 || status === "shipped") {
      return JSON.stringify({
        success: false,
        message: "已出貨明細不可標記缺貨",
      });
    }

    if (status !== "pending" && status !== "ordered" && status !== "received") {
      return JSON.stringify({
        success: false,
        message: "僅待處理、已訂購或已到貨明細可標記缺貨",
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
                "SET #st = :outOfStock, outOfStockAt = :now, updatedAt = :now",
              ConditionExpression:
                "orderId = :orderId AND (#st = :pending OR #st = :ordered OR #st = :received)",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":orderId": orderId,
                ":pending": "pending",
                ":ordered": "ordered",
                ":received": "received",
                ":outOfStock": "out_of_stock",
                ":now": now,
              }),
            },
          },
        ],
      }),
    );

    return JSON.stringify({
      success: true,
      message: "確認缺貨成功",
      data: {
        lineItemId,
        lineItemStatus: "out_of_stock",
        outOfStockAt: now,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message: "確認缺貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    console.error("confirmOutOfStock error:", error);
    return JSON.stringify({
      success: false,
      message: `確認缺貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
