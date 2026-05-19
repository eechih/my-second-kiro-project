import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { normalizeOrderItemStatus } from "@shared/models/order";
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
 * - OrderItem status 從 received 改回 ordered，移除 receivedAt
 * - 扣回 Product.stockQuantity（扣回 lineItem.quantity）
 *
 * 僅允許狀態為 received 的明細撤銷（shipped 狀態不可撤銷）。
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
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 OrderItem 資料
    const lineItemResult = await ddb.send(
      new GetItemCommand({
        TableName: lineItemTable,
        Key: marshall({ id: lineItemId }),
      }),
    );

    if (!lineItemResult.Item) {
      logWarn(FUNCTION_NAME, "line item not found", { lineItemId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的明細項目",
      });
    }

    const lineItem = unmarshall(lineItemResult.Item);
    const status = normalizeOrderItemStatus(lineItem["status"]);
    const quantity = Number(lineItem["quantity"] ?? 0);
    const productId = String(lineItem["productId"] ?? "");
    logDebug(FUNCTION_NAME, "line item loaded", {
      lineItemId,
      productId,
      status,
      rawStatus: lineItem["status"],
      quantity,
    });

    // 2. 驗證狀態——僅 received 可撤銷
    if (status !== "received") {
      logWarn(FUNCTION_NAME, "invalid line item status", {
        lineItemId,
        productId,
        status,
      });
      return JSON.stringify({
        success: false,
        message: "僅已到貨的明細可取消到貨",
      });
    }

    if (!productId) {
      return JSON.stringify({
        success: false,
        message: "明細商品資料不完整，無法取消到貨",
      });
    }

    const now = new Date().toISOString();

    // 3. 執行交易：OrderItem 狀態回 ordered + 庫存扣回
    logDebug(FUNCTION_NAME, "executing transaction", {
      lineItemId,
      productId,
      quantity,
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
              ConditionExpression: "#st = :received OR #st = :legacyReceived",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":ordered": "ordered",
                ":received": "received",
                ":legacyReceived": "已收到",
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
                ":qty": quantity,
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
      quantity,
      lineItemStatus: "ordered",
    });
    return JSON.stringify({
      success: true,
      message: "取消到貨成功",
      data: {
        lineItemId,
        quantity,
        lineItemStatus: "ordered",
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        lineItemId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "取消到貨失敗，庫存不足或資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { lineItemId });
    return JSON.stringify({
      success: false,
      message: `取消到貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
