import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { normalizeLineItemStatus } from "@shared/models/order";
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
  logInfo(FUNCTION_NAME, "handler started", { lineItemId });

  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];

  if (!lineItemTable || !productTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasLineItemTable: !!lineItemTable,
      hasProductTable: !!productTable,
    });
    return {
      success: false,
      message: "缺少必要的環境變數設定",
    };
  }

  try {
    const lineItemResult = await ddb.send(
      new GetItemCommand({
        TableName: lineItemTable,
        Key: marshall({ id: lineItemId }),
      }),
    );

    if (!lineItemResult.Item) {
      logWarn(FUNCTION_NAME, "line item not found", { lineItemId });
      return {
        success: false,
        message: "找不到指定的明細項目",
      };
    }

    const lineItem = unmarshall(lineItemResult.Item);
    const status = normalizeLineItemStatus(lineItem["status"]);
    const shippedQuantity = Number(lineItem["shippedQuantity"] ?? 0);
    const purchasedQuantity = Number(lineItem["purchasedQuantity"] ?? 0);
    const productId = String(lineItem["productId"] ?? "");
    logDebug(FUNCTION_NAME, "line item loaded", {
      lineItemId,
      productId,
      status,
      rawStatus: lineItem["status"],
      shippedQuantity,
      purchasedQuantity,
    });

    if (status !== "received") {
      logWarn(FUNCTION_NAME, "invalid line item status", {
        lineItemId,
        productId,
        status,
      });
      return {
        success: false,
        message: "僅已到貨且尚未出貨的明細可取消到貨",
      };
    }

    if (shippedQuantity > 0) {
      logWarn(FUNCTION_NAME, "line item already shipped", {
        lineItemId,
        productId,
        shippedQuantity,
      });
      return {
        success: false,
        message: "已出貨明細不可取消到貨",
      };
    }

    if (purchasedQuantity <= 0 || !productId) {
      logWarn(FUNCTION_NAME, "incomplete line item procurement data", {
        lineItemId,
        productId,
        purchasedQuantity,
      });
      return {
        success: false,
        message: "明細採購資料不完整，無法取消到貨",
      };
    }

    const now = new Date().toISOString();

    logDebug(FUNCTION_NAME, "executing transaction", {
      lineItemId,
      productId,
      purchasedQuantity,
      shippedQuantity,
      transactItemCount: 2,
    });
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

    logInfo(FUNCTION_NAME, "handler succeeded", {
      lineItemId,
      productId,
      quantity: purchasedQuantity,
      lineItemStatus: "ordered",
    });
    return {
      success: true,
      message: "取消到貨成功",
      data: {
        lineItemId,
        quantity: purchasedQuantity,
        lineItemStatus: "ordered",
      },
    };
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        lineItemId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return {
        success: false,
        message: "取消到貨失敗，庫存不足或資料已變更，請重新取得最新資料後重試",
      };
    }

    logError(FUNCTION_NAME, "handler failed", error, { lineItemId });
    return {
      success: false,
      message: `取消到貨失敗：${err.message ?? "未知錯誤"}`,
    };
  }
};
