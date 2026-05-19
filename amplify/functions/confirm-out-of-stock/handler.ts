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
const FUNCTION_NAME = "confirmOutOfStock";

/**
 * 確認缺貨 Lambda 函式
 *
 * 將可處理中的 OrderItem 標記為 out_of_stock 並記錄 outOfStockAt。
 * orderId 從 OrderItem 記錄中讀取，前端只需傳 orderItemId。
 */
export const handler: Schema["confirmOutOfStock"]["functionHandler"] = async (
  event,
) => {
  const { orderItemId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderItemId });

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
    // 1. 取得 OrderItem 資料（含 orderId）
    const lineItemResult = await ddb.send(
      new GetItemCommand({
        TableName: lineItemTable,
        Key: marshall({ id: orderItemId }),
      }),
    );

    if (!lineItemResult.Item) {
      logWarn(FUNCTION_NAME, "line item not found", { orderItemId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的明細項目",
      });
    }

    const lineItem = unmarshall(lineItemResult.Item);
    const status = normalizeOrderItemStatus(lineItem["status"]);
    const orderId = String(lineItem["orderId"] ?? "");
    logDebug(FUNCTION_NAME, "line item loaded", {
      orderItemId,
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
      logWarn(FUNCTION_NAME, "order not found", { orderId, orderItemId });
      return JSON.stringify({ success: false, message: "找不到指定的訂單" });
    }

    const order = unmarshall(orderResult.Item);
    if (normalizeOrderStatus(order["status"]) === "cancelled") {
      return JSON.stringify({
        success: false,
        message: "已取消訂單不可標記缺貨",
      });
    }

    // 3. 驗證明細狀態——僅 pending/ordered/received 可標記缺貨
    if (status !== "pending" && status !== "ordered" && status !== "received") {
      return JSON.stringify({
        success: false,
        message: "僅待處理、已訂購或已到貨明細可標記缺貨",
      });
    }

    const now = new Date().toISOString();

    // 4. 執行交易
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderItemId,
      orderId,
      previousStatus: status,
      transactItemCount: 1,
    });
    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: lineItemTable,
              Key: marshall({ id: orderItemId }),
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

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderItemId,
      orderId,
      lineItemStatus: "out_of_stock",
    });
    return JSON.stringify({
      success: true,
      message: "確認缺貨成功",
      data: {
        orderItemId,
        lineItemStatus: "out_of_stock",
        outOfStockAt: now,
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
        message: "確認缺貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderItemId });
    return JSON.stringify({
      success: false,
      message: `確認缺貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
