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
const FUNCTION_NAME = "cancelPurchase";
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
 * 取消採購 Lambda 函式
 *
 * 將 Order 的 status 從 ORDERED 回退為 PENDING，
 * 清除 purchasedAt，保留 supplierName，並附加 statusHistory 記錄。
 *
 * 支援批次處理：一次最多可取消 20 筆採購。
 *
 * 注意：ORDERED→PENDING 為回退操作，不在正向狀態轉換表內，
 * 此處直接驗證目前狀態為 ORDERED 後手動回退。
 *
 * 需求：2.5, 3.8
 */
export const handler: Schema["cancelPurchase"]["functionHandler"] = async (
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
        message: "請指定要取消採購的訂單",
      });
    }

    if (targetOrderIds.length > MAX_BATCH_SIZE) {
      return JSON.stringify({
        success: false,
        message: `一次最多可取消 ${MAX_BATCH_SIZE} 筆採購`,
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
          message: "訂單狀態無法識別，無法取消採購",
        });
      }

      const currentStatus: OrderFulfillmentStatus = rawStatus;
      const targetStatus: OrderFulfillmentStatus = "PENDING";

      // 3. 驗證目前狀態為 ORDERED（僅已採購狀態可取消採購回退至 PENDING）
      if (currentStatus !== "ORDERED") {
        logWarn(FUNCTION_NAME, "invalid status for cancel purchase", {
          orderId: targetOrderId,
          currentStatus,
        });
        return JSON.stringify({
          success: false,
          message: `無法從「${currentStatus}」狀態取消採購，僅「ORDERED」狀態可取消採購`,
        });
      }

      const nextOrder = {
        ...order,
        id: targetOrderId,
        status: targetStatus,
        purchasedAt: null,
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
            "SET #st = :newStatus, statusHistory = :history, updatedAt = :now REMOVE purchasedAt",
          ConditionExpression: "#st = :ordered",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":newStatus": targetStatus,
            ":ordered": "ORDERED",
            ":now": now,
            ":history": updatedHistory,
          }),
        },
      });
      resultOrders.push({
        orderId: targetOrderId,
        status: targetStatus,
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
          ? `已取消 ${targetOrderIds.length} 筆採購`
          : "取消採購成功",
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
        message: "取消採購失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, {
      orderIds: targetOrderIds,
    });
    return JSON.stringify({
      success: false,
      message: `取消採購失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
