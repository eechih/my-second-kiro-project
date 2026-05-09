import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { normalizeLineItemStatus } from "@shared/models/order";

const ddb = new DynamoDBClient({});

/**
 * 撤銷入庫確認 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - LineItem status 從 received 改回 ordered，移除 receivedAt
 * - 扣回 Product.stockQuantity
 *
 * 僅允許尚未出貨的已入庫明細撤銷，並以條件式更新避免庫存扣成負數。
 */
export const handler: Schema["cancelReceived"]["functionHandler"] = async (
  event,
) => {
  const { lineItemId } = event.arguments;

  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];

  if (!lineItemTable || !productTable) {
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    const lineItemResult = await ddb.send(
      new GetItemCommand({
        TableName: lineItemTable,
        Key: marshall({ id: lineItemId }),
      }),
    );

    if (!lineItemResult.Item) {
      return JSON.stringify({
        success: false,
        message: "找不到指定的明細項目",
      });
    }

    const lineItem = unmarshall(lineItemResult.Item);
    const status = normalizeLineItemStatus(lineItem["status"]);
    const shippedQuantity = Number(lineItem["shippedQuantity"] ?? 0);
    const purchasedQuantity = Number(lineItem["purchasedQuantity"] ?? 0);
    const productId = String(lineItem["productId"] ?? "");

    if (status !== "received") {
      return JSON.stringify({
        success: false,
        message: "僅已到貨且尚未出貨的明細可取消到貨",
      });
    }

    if (shippedQuantity > 0) {
      return JSON.stringify({
        success: false,
        message: "已出貨明細不可取消到貨",
      });
    }

    if (purchasedQuantity <= 0 || !productId) {
      return JSON.stringify({
        success: false,
        message: "明細採購資料不完整，無法取消到貨",
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
                "SET #st = :ordered, updatedAt = :now REMOVE receivedAt",
              ConditionExpression:
                "(#st = :received OR #st = :legacyReceived) AND (attribute_not_exists(shippedQuantity) OR shippedQuantity = :zero)",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":ordered": "ordered",
                ":received": "received",
                ":legacyReceived": "已收到",
                ":zero": 0,
                ":now": now,
              }),
            },
          },
          {
            Update: {
              TableName: productTable,
              Key: marshall({ id: productId }),
              UpdateExpression:
                "SET stockQuantity = stockQuantity - :qty, updatedAt = :now",
              ConditionExpression:
                "attribute_exists(id) AND stockQuantity >= :qty",
              ExpressionAttributeValues: marshall({
                ":qty": purchasedQuantity,
                ":now": now,
              }),
            },
          },
        ],
      }),
    );

    return JSON.stringify({
      success: true,
      message: "取消到貨成功",
      data: {
        lineItemId,
        quantity: purchasedQuantity,
        lineItemStatus: "ordered",
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message: "取消到貨失敗，庫存不足或資料已變更，請重新取得最新資料後重試",
      });
    }

    console.error("cancelReceived error:", error);
    return JSON.stringify({
      success: false,
      message: `取消到貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
