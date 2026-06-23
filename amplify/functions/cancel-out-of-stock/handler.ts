import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  type TransactWriteItem,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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
const FUNCTION_NAME = "cancelOutOfStock";
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
 * 取消缺貨 Lambda 函式
 *
 * 將 Order 的 status 從 OUT_OF_STOCK 回退至先前狀態：
 * - 檢查 statusHistory 最後一筆的 fromStatus 作為回退目標
 * - 若無歷史記錄，預設回退至 PENDING
 * - 有效的回退目標為 PENDING 或 ORDERED（因為只有這兩個狀態可轉為 OUT_OF_STOCK）
 *
 * 支援批次處理：一次最多可取消 20 筆缺貨。
 *
 * 需求：2.5, 3.8
 */
export const handler: Schema["cancelOutOfStock"]["functionHandler"] = async (
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
        message: "請指定要取消缺貨的訂單",
      });
    }

    if (targetOrderIds.length > MAX_BATCH_SIZE) {
      return JSON.stringify({
        success: false,
        message: `一次最多可取消 ${MAX_BATCH_SIZE} 筆缺貨`,
      });
    }

    const now = new Date().toISOString();
    const changes: OrderSummaryChange[] = [];
    const orderUpdates: TransactWriteItem[] = [];
    const resultOrders: Array<{
      orderId: string;
      status: OrderFulfillmentStatus;
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
          message: "訂單狀態無法識別，無法取消缺貨",
        });
      }

      const currentStatus: OrderFulfillmentStatus = rawStatus;

      // 3. 驗證目前狀態為 OUT_OF_STOCK（僅缺貨狀態可取消缺貨）
      if (currentStatus !== "OUT_OF_STOCK") {
        logWarn(FUNCTION_NAME, "invalid status for cancel out of stock", {
          orderId: targetOrderId,
          currentStatus,
        });
        return JSON.stringify({
          success: false,
          message: `無法從「${currentStatus}」狀態取消缺貨，僅「OUT_OF_STOCK」狀態可取消缺貨`,
        });
      }

      // 4. 決定回退目標狀態
      const existingHistory = Array.isArray(order["statusHistory"])
        ? (order["statusHistory"] as Record<string, unknown>[])
        : [];

      let restoreTarget: OrderFulfillmentStatus = "PENDING";

      if (existingHistory.length > 0) {
        const lastEntry = existingHistory[existingHistory.length - 1];
        const fromStatus = lastEntry?.["fromStatus"];
        if (
          isOrderFulfillmentStatus(fromStatus) &&
          (fromStatus === "PENDING" || fromStatus === "ORDERED")
        ) {
          restoreTarget = fromStatus;
        }
      }

      logDebug(FUNCTION_NAME, "restore target determined", {
        orderId: targetOrderId,
        restoreTarget,
        historyLength: existingHistory.length,
      });

      const nextOrder = {
        ...order,
        id: targetOrderId,
        status: restoreTarget,
        outOfStockAt: null,
        updatedAt: now,
      };
      const updatedHistory = [
        ...existingHistory,
        {
          fromStatus: currentStatus,
          toStatus: restoreTarget,
          changedAt: now,
        },
      ];

      changes.push({ before: order, after: nextOrder });
      orderUpdates.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ id: targetOrderId }),
          UpdateExpression:
            "SET #st = :newStatus, supplierStatusSort = :supplierStatusSort, customerStatusSort = :customerStatusSort, statusHistory = :history, updatedAt = :now REMOVE outOfStockAt",
          ConditionExpression: "#st = :outOfStock",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":newStatus": restoreTarget,
            ":outOfStock": "OUT_OF_STOCK",
            ":now": now,
            ":supplierStatusSort": `${restoreTarget}#${toTrimmedString(order["createdAtForSort"]) || now}`,
            ":customerStatusSort": `${restoreTarget}#${toTrimmedString(order["createdAtForSort"]) || now}`,
            ":history": updatedHistory,
          }),
        },
      });
      resultOrders.push({
        orderId: targetOrderId,
        status: restoreTarget,
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
    });

    return JSON.stringify({
      success: true,
      message:
        targetOrderIds.length > 1
          ? `已取消 ${targetOrderIds.length} 筆缺貨`
          : "取消缺貨成功",
      data: {
        orderId: targetOrderIds[0],
        orderIds: targetOrderIds,
        orders: resultOrders,
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
        message: "取消缺貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, {
      orderIds: targetOrderIds,
    });
    return JSON.stringify({
      success: false,
      message: `取消缺貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
