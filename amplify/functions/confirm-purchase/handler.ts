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
 * 將 pending 明細標記為 ordered，並寫入採購數量、時間與可選供應商/成本資料。
 */
export const handler: Schema["confirmPurchase"]["functionHandler"] = async (
  event,
) => {
  const {
    orderId,
    lineItemId,
    supplierId,
    supplierName,
    unitCost,
    quantity,
  } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", {
    orderId,
    lineItemId,
    supplierId,
    quantity,
  });

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
      logWarn(FUNCTION_NAME, "order not found", { orderId, lineItemId });
      return JSON.stringify({ success: false, message: "找不到指定的訂單" });
    }

    if (!lineItemResult.Item) {
      logWarn(FUNCTION_NAME, "line item not found", { orderId, lineItemId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的明細項目",
      });
    }

    const order = unmarshall(orderResult.Item);
    if (normalizeOrderStatus(order["status"]) === "cancelled") {
      return JSON.stringify({
        success: false,
        message: "已取消訂單不可確認採購",
      });
    }

    const lineItem = unmarshall(lineItemResult.Item);
    const status = normalizeLineItemStatus(lineItem["status"]);
    const lineItemOrderId = String(lineItem["orderId"] ?? "");
    const orderQuantity = Number(lineItem["quantity"] ?? 0);
    const purchaseQuantity = Number(quantity ?? orderQuantity);
    logDebug(FUNCTION_NAME, "line item loaded", {
      orderId,
      lineItemId,
      lineItemOrderId,
      status,
      orderQuantity,
      purchaseQuantity,
      rawStatus: lineItem["status"],
    });

    if (lineItemOrderId !== orderId) {
      return JSON.stringify({
        success: false,
        message: "明細項目不屬於指定訂單",
      });
    }

    if (status !== "pending") {
      return JSON.stringify({
        success: false,
        message: "僅待處理明細可確認採購",
      });
    }

    if (purchaseQuantity <= 0 || purchaseQuantity > orderQuantity) {
      return JSON.stringify({
        success: false,
        message: "採購數量必須大於 0 且不可超過訂購數量",
      });
    }

    if (unitCost !== undefined && unitCost !== null && Number(unitCost) < 0) {
      return JSON.stringify({
        success: false,
        message: "單位成本不可小於 0",
      });
    }

    const now = new Date().toISOString();

    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      lineItemId,
      supplierId,
      purchaseQuantity,
      transactItemCount: 1,
    });
    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: lineItemTable,
              Key: marshall({ id: lineItemId }),
              UpdateExpression:
                "SET #st = :ordered, purchasedQuantity = :quantity, purchasedAt = :now, supplierId = :supplierId, supplierName = :supplierName, unitCost = :unitCost, updatedAt = :now",
              ConditionExpression: "orderId = :orderId AND #st = :pending",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall(
                {
                  ":orderId": orderId,
                  ":pending": "pending",
                  ":ordered": "ordered",
                  ":quantity": purchaseQuantity,
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
      orderId,
      lineItemId,
      supplierId,
      purchasedQuantity: purchaseQuantity,
      lineItemStatus: "ordered",
    });
    return JSON.stringify({
      success: true,
      message: "確認採購成功",
      data: {
        lineItemId,
        lineItemStatus: "ordered",
        purchasedQuantity: purchaseQuantity,
        purchasedAt: now,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        orderId,
        lineItemId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "確認採購失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderId, lineItemId });
    return JSON.stringify({
      success: false,
      message: `確認採購失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
