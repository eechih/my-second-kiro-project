import type { Schema } from "../../data/resource";
import type { OrderFulfillmentStatus } from "@shared/models/order";
import { isOrderFulfillmentStatus } from "@shared/models/order";
import {
  DynamoDBClient,
  GetItemCommand,
  type TransactWriteItem,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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
const FUNCTION_NAME = "cancelReceived";
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
 * 撤銷入庫確認 Lambda 函式
 *
 * 將 Order 狀態從 RECEIVED 回退為 ORDERED，
 * 並在同一交易中扣減 Product 庫存。
 *
 * 支援批次處理：一次最多可取消 20 筆入庫。
 *
 * 需求：2.5, 3.8
 */
export const handler: Schema["cancelReceived"]["functionHandler"] = async (
  event,
) => {
  const { orderIds } = event.arguments;
  const targetOrderIds = normalizeOrderIds(orderIds);
  logInfo(FUNCTION_NAME, "handler started", { orderIds, targetOrderIds });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];
  const customerSummaryTable = process.env["CUSTOMER_ORDER_SUMMARY_TABLE_NAME"];
  const productSummaryTable = process.env["PRODUCT_ORDER_SUMMARY_TABLE_NAME"];
  const supplierSummaryTable = process.env["SUPPLIER_ORDER_SUMMARY_TABLE_NAME"];

  if (
    !orderTable ||
    !productTable ||
    !customerSummaryTable ||
    !productSummaryTable ||
    !supplierSummaryTable
  ) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasProductTable: !!productTable,
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
        message: "請指定要取消入庫的訂單",
      });
    }

    if (targetOrderIds.length > MAX_BATCH_SIZE) {
      return JSON.stringify({
        success: false,
        message: `一次最多可取消 ${MAX_BATCH_SIZE} 筆入庫`,
      });
    }

    const now = new Date().toISOString();
    const changes: OrderSummaryChange[] = [];
    const transactItems: TransactWriteItem[] = [];
    const resultOrders: Array<{
      orderId: string;
      productId: string;
      quantity: number;
      status: OrderFulfillmentStatus;
    }> = [];

    for (const targetOrderId of targetOrderIds) {
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
      const status: OrderFulfillmentStatus = isOrderFulfillmentStatus(rawStatus)
        ? rawStatus
        : "PENDING";
      const productId = toTrimmedString(order["productId"]);
      const quantity = Number(order["quantity"] ?? 0);

      if (status !== "RECEIVED") {
        return JSON.stringify({
          success: false,
          message: "僅已到貨的訂單可取消到貨",
        });
      }

      if (!productId) {
        return JSON.stringify({
          success: false,
          message: "訂單缺少商品資料，無法取消到貨",
        });
      }

      const targetStatus: OrderFulfillmentStatus = "ORDERED";
      const nextOrder = {
        ...order,
        id: targetOrderId,
        status: targetStatus,
        receivedAt: null,
        updatedAt: now,
      };
      const existingHistory = Array.isArray(order["statusHistory"])
        ? (order["statusHistory"] as Record<string, unknown>[])
        : [];
      const updatedHistory = [
        ...existingHistory,
        { fromStatus: "RECEIVED", toStatus: targetStatus, changedAt: now },
      ];

      changes.push({ before: order, after: nextOrder });

      // Order status update
      transactItems.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ id: targetOrderId }),
          UpdateExpression:
            "SET #st = :ordered, supplierStatusSort = :supplierStatusSort, customerStatusSort = :customerStatusSort, statusHistory = :history, updatedAt = :now REMOVE receivedAt",
          ConditionExpression: "#st = :received",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":ordered": targetStatus,
            ":received": "RECEIVED",
            ":history": updatedHistory,
            ":now": now,
            ":supplierStatusSort": `${targetStatus}#${toTrimmedString(order["createdAtForSort"]) || now}`,
            ":customerStatusSort": `${targetStatus}#${toTrimmedString(order["createdAtForSort"]) || now}`,
          }),
        },
      });

      // Product stock decrease
      transactItems.push({
        Update: {
          TableName: productTable,
          Key: marshall({ id: productId }),
          UpdateExpression:
            "SET stockQuantity = stockQuantity - :qty, updatedAt = :now",
          ConditionExpression: "attribute_exists(id) AND stockQuantity >= :qty",
          ExpressionAttributeValues: marshall({
            ":qty": quantity,
            ":now": now,
          }),
        },
      });

      resultOrders.push({
        orderId: targetOrderId,
        productId,
        quantity,
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
      transactItemCount: transactItems.length + summaryItems.length,
    });

    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [...transactItems, ...summaryItems],
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
          ? `已取消 ${targetOrderIds.length} 筆入庫`
          : "取消到貨成功",
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
        message: "取消到貨失敗，庫存不足或資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, {
      orderIds: targetOrderIds,
    });
    return JSON.stringify({
      success: false,
      message: `取消到貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
