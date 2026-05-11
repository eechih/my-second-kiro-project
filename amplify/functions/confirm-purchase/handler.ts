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
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmPurchase";

/**
 * 確認採購 Lambda 函式
 *
 * 將 pending 明細標記為 ordered，寫入採購時間與可選供應商/成本資料。
 * orderId 從 LineItem 記錄中讀取，前端只需傳 lineItemId。
 * 不再有分批採購——採購即為明細的全部數量。
 */
export const handler: Schema["confirmPurchase"]["functionHandler"] = async (
  event,
) => {
  const { lineItemId, supplierId, supplierName, unitCost } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { lineItemId, supplierId });

  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const orderTable = process.env["ORDER_TABLE_NAME"];

  if (!lineItemTable || !orderTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasLineItemTable: !!lineItemTable,
      hasOrderTable: !!orderTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 LineItem 資料（含 orderId）
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
    const orderId = String(lineItem["orderId"] ?? "");
    const status = normalizeLineItemStatus(lineItem["status"]);
    logDebug(FUNCTION_NAME, "line item loaded", {
      lineItemId,
      orderId,
      status,
      rawStatus: lineItem["status"],
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
      logWarn(FUNCTION_NAME, "order not found", { orderId, lineItemId });
      return JSON.stringify({ success: false, message: "找不到指定的訂單" });
    }

    const order = unmarshall(orderResult.Item);
    if (normalizeOrderStatus(order["status"]) === "cancelled") {
      return JSON.stringify({
        success: false,
        message: "已取消訂單不可確認採購",
      });
    }

    // 3. 驗證明細狀態
    if (status !== "pending") {
      return JSON.stringify({
        success: false,
        message: "僅待處理明細可確認採購",
      });
    }

    // 4. 驗證成本
    if (unitCost !== undefined && unitCost !== null && Number(unitCost) < 0) {
      return JSON.stringify({
        success: false,
        message: "單位成本不可小於 0",
      });
    }

    const now = new Date().toISOString();

    // 5. 執行交易：更新明細狀態為 ordered + 寫入採購資料
    logDebug(FUNCTION_NAME, "executing transaction", {
      lineItemId,
      orderId,
      supplierId,
    });
    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: lineItemTable,
              Key: marshall({ id: lineItemId }),
              UpdateExpression:
                "SET #st = :ordered, purchasedAt = :now, supplierId = :supplierId, supplierName = :supplierName, unitCost = :unitCost, updatedAt = :now",
              ConditionExpression: "orderId = :orderId AND #st = :pending",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall(
                {
                  ":orderId": orderId,
                  ":pending": "pending",
                  ":ordered": "ordered",
                  ":supplierId": supplierId ?? null,
                  ":supplierName": supplierName ?? null,
                  ":unitCost": unitCost ?? null,
                  ":now": now,
                },
                { removeUndefinedValues: true },
              ),
            },
          },
        ],
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      lineItemId,
      orderId,
      supplierId,
      lineItemStatus: "ordered",
    });
    return JSON.stringify({
      success: true,
      message: "確認採購成功",
      data: {
        lineItemId,
        lineItemStatus: "ordered",
        purchasedAt: now,
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
        message: "確認採購失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { lineItemId });
    return JSON.stringify({
      success: false,
      message: `確認採購失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
