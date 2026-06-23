import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  type TransactWriteItem,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidOrderStatusTransition } from "@shared/logic/order-status";
import type { OrderFulfillmentStatus } from "@shared/models/order";
import { isOrderFulfillmentStatus } from "@shared/models/order";
import {
  buildOrderSummaryTransactItems,
  type OrderSummaryChange,
  type RawOrder,
} from "../order-summary-sync";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmOutOfStock";
const MAX_BATCH_SIZE = 20;

function toTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeOrderIds(orderIds: (string | null)[]): string[] {
  return Array.from(new Set(orderIds.map(toTrimmedString).filter(Boolean)));
}

async function getOrder(
  orderTable: string,
  orderId: string,
): Promise<RawOrder | null> {
  const orderResult = await ddb.send(
    new GetItemCommand({
      TableName: orderTable,
      Key: marshall({ id: orderId }),
    }),
  );

  return orderResult.Item ? (unmarshall(orderResult.Item) as RawOrder) : null;
}

/**
 * 確認缺貨 Lambda 函式
 *
 * 將 Order 的 status 從 PENDING 或 ORDERED 轉換為 OUT_OF_STOCK，
 * 記錄 outOfStockAt，並附加 statusHistory 記錄。
 *
 * 支援批次處理：一次最多可確認 20 筆缺貨。
 *
 * 需求：2.5, 3.6, 3.9
 */
export const handler: Schema["confirmOutOfStock"]["functionHandler"] = async (
  event,
) => {
  const { orderIds } = event.arguments;
  const targetOrderIds = normalizeOrderIds(orderIds);
  logInfo(FUNCTION_NAME, "handler started", {
    orderIds,
    targetOrderIds,
  });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const customerSummaryTable = process.env["CUSTOMER_ORDER_SUMMARY_TABLE_NAME"];
  const productSummaryTable = process.env["PRODUCT_ORDER_SUMMARY_TABLE_NAME"];
  const supplierSummaryTable = process.env["SUPPLIER_ORDER_SUMMARY_TABLE_NAME"];

  if (
    !orderTable ||
    !customerSummaryTable ||
    !productSummaryTable ||
    !supplierSummaryTable
  ) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasCustomerSummaryTable: !!customerSummaryTable,
      hasProductSummaryTable: !!productSummaryTable,
      hasSupplierSummaryTable: !!supplierSummaryTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    if (targetOrderIds.length === 0) {
      return JSON.stringify({
        success: false,
        message: "請指定要確認缺貨的訂單",
      });
    }

    if (targetOrderIds.length > MAX_BATCH_SIZE) {
      return JSON.stringify({
        success: false,
        message: `一次最多可確認 ${MAX_BATCH_SIZE} 筆缺貨`,
      });
    }

    const now = new Date().toISOString();
    const changes: OrderSummaryChange[] = [];
    const orderUpdates: TransactWriteItem[] = [];
    const resultOrders: Array<{
      orderId: string;
      status: OrderFulfillmentStatus;
      outOfStockAt: string;
    }> = [];

    for (const targetOrderId of targetOrderIds) {
      // 1. 取得 Order 資料
      const order = await getOrder(orderTable, targetOrderId);

      if (!order) {
        logWarn(FUNCTION_NAME, "order not found", { orderId: targetOrderId });
        return JSON.stringify({
          success: false,
          message:
            targetOrderIds.length > 1
              ? `找不到指定的訂單：${targetOrderId}`
              : "找不到指定的訂單",
        });
      }

      const rawStatus = order["status"];
      logDebug(FUNCTION_NAME, "order loaded", {
        orderId: targetOrderId,
        rawStatus,
      });

      // 2. 驗證目前狀態是否為合法的 OrderFulfillmentStatus
      if (!isOrderFulfillmentStatus(rawStatus)) {
        logWarn(FUNCTION_NAME, "invalid order status", {
          orderId: targetOrderId,
          rawStatus,
        });
        return JSON.stringify({
          success: false,
          message: "訂單狀態無法識別，無法確認缺貨",
        });
      }

      const currentStatus: OrderFulfillmentStatus = rawStatus;
      const targetStatus: OrderFulfillmentStatus = "OUT_OF_STOCK";

      // 3. 使用共用邏輯驗證狀態轉換合法性（PENDING → OUT_OF_STOCK 或 ORDERED → OUT_OF_STOCK）
      if (!isValidOrderStatusTransition(currentStatus, targetStatus)) {
        logWarn(FUNCTION_NAME, "invalid status transition", {
          orderId: targetOrderId,
          currentStatus,
          targetStatus,
        });
        return JSON.stringify({
          success: false,
          message: `無法從「${currentStatus}」狀態確認缺貨，僅「PENDING」或「ORDERED」狀態可確認缺貨`,
        });
      }

      const nextOrder = {
        ...order,
        id: targetOrderId,
        status: targetStatus,
        outOfStockAt: now,
        updatedAt: now,
      };
      const existingHistory = Array.isArray(order["statusHistory"])
        ? (order["statusHistory"] as Record<string, unknown>[])
        : [];
      const updatedHistory = [
        ...existingHistory,
        {
          fromStatus: currentStatus,
          toStatus: targetStatus,
          changedAt: now,
        },
      ];

      changes.push({ before: order, after: nextOrder });
      orderUpdates.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ id: targetOrderId }),
          UpdateExpression:
            "SET #st = :newStatus, supplierStatusSort = :supplierStatusSort, customerStatusSort = :customerStatusSort, outOfStockAt = :now, statusHistory = :history, updatedAt = :now",
          ConditionExpression: "#st = :expectedStatus",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":newStatus": targetStatus,
            ":expectedStatus": currentStatus,
            ":now": now,
            ":supplierStatusSort": `${targetStatus}#${toTrimmedString(order["createdAtForSort"]) || now}`,
            ":customerStatusSort": `${targetStatus}#${toTrimmedString(order["createdAtForSort"]) || now}`,
            ":history": updatedHistory,
          }),
        },
      });
      resultOrders.push({
        orderId: targetOrderId,
        status: targetStatus,
        outOfStockAt: now,
      });
    }

    const summaryItems = await buildOrderSummaryTransactItems({
      ddb,
      tables: {
        orderTable,
        customerSummaryTable,
        productSummaryTable,
        supplierSummaryTable,
      },
      changes,
      now,
    });

    logDebug(FUNCTION_NAME, "executing transaction", {
      orderIds: targetOrderIds,
      orderUpdateCount: orderUpdates.length,
      summaryItemCount: summaryItems.length,
    });

    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [...orderUpdates, ...summaryItems],
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderIds: targetOrderIds,
      orderCount: targetOrderIds.length,
      outOfStockAt: now,
    });

    return JSON.stringify({
      success: true,
      message:
        targetOrderIds.length > 1
          ? `已確認 ${targetOrderIds.length} 筆缺貨`
          : "確認缺貨成功",
      data: {
        orderId: targetOrderIds[0],
        orderIds: targetOrderIds,
        orders: resultOrders,
        outOfStockAt: now,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        orderIds: targetOrderIds,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "確認缺貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, {
      orderIds: targetOrderIds,
    });
    return JSON.stringify({
      success: false,
      message: `確認缺貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
