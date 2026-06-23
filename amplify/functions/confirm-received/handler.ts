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
const FUNCTION_NAME = "confirmReceived";
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
 * 入庫確認 Lambda 函式
 *
 * 將 Order 的 status 從 ORDERED 轉換為 RECEIVED，
 * 記錄 receivedAt，附加 statusHistory 記錄，
 * 並在同一交易中增加 Product 的 stockQuantity。
 *
 * 支援批次處理：一次最多可確認 20 筆入庫。
 *
 * 需求：2.5, 3.3, 3.9
 */
export const handler: Schema["confirmReceived"]["functionHandler"] = async (
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
        message: "請指定要確認入庫的訂單",
      });
    }

    if (targetOrderIds.length > MAX_BATCH_SIZE) {
      return JSON.stringify({
        success: false,
        message: `一次最多可確認 ${MAX_BATCH_SIZE} 筆入庫`,
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
      receivedAt: string;
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
      const productId = toTrimmedString(order["productId"]);
      const quantity = Number(order["quantity"] ?? 0);

      if (!productId) {
        return JSON.stringify({
          success: false,
          message: "訂單缺少商品關聯",
        });
      }

      if (!isOrderFulfillmentStatus(rawStatus)) {
        return JSON.stringify({
          success: false,
          message: "訂單狀態無法識別，無法確認入庫",
        });
      }

      const currentStatus: OrderFulfillmentStatus = rawStatus;
      const targetStatus: OrderFulfillmentStatus = "RECEIVED";

      if (!isValidOrderStatusTransition(currentStatus, targetStatus)) {
        return JSON.stringify({
          success: false,
          message: `無法從「${currentStatus}」狀態確認入庫，僅「ORDERED」狀態可確認入庫`,
        });
      }

      const nextOrder = {
        ...order,
        id: targetOrderId,
        status: targetStatus,
        receivedAt: now,
        updatedAt: now,
      };
      const existingHistory = Array.isArray(order["statusHistory"])
        ? (order["statusHistory"] as Record<string, unknown>[])
        : [];
      const updatedHistory = [
        ...existingHistory,
        { fromStatus: currentStatus, toStatus: targetStatus, changedAt: now },
      ];

      changes.push({ before: order, after: nextOrder });

      // Order status update
      transactItems.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ id: targetOrderId }),
          UpdateExpression:
            "SET #st = :newStatus, supplierStatusSort = :supplierStatusSort, customerStatusSort = :customerStatusSort, receivedAt = :now, statusHistory = :history, updatedAt = :now",
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

      // Product stock increase
      transactItems.push({
        Update: {
          TableName: productTable,
          Key: marshall({ id: productId }),
          UpdateExpression:
            "SET stockQuantity = stockQuantity + :qty, updatedAt = :now",
          ConditionExpression: "attribute_exists(id)",
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
        receivedAt: now,
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
      receivedAt: now,
    });

    return JSON.stringify({
      success: true,
      message:
        targetOrderIds.length > 1
          ? `已確認 ${targetOrderIds.length} 筆入庫`
          : "入庫確認成功",
      data: {
        orderId: targetOrderIds[0],
        orderIds: targetOrderIds,
        orders: resultOrders,
        receivedAt: now,
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
        message: "入庫確認失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, {
      orderIds: targetOrderIds,
    });
    return JSON.stringify({
      success: false,
      message: `入庫確認失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
