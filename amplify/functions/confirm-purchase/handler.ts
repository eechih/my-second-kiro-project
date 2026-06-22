import type { Schema } from "../../data/resource";
import {
  type AttributeValue,
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidOrderStatusTransition } from "@shared/logic/order-status";
import type { OrderFulfillmentStatus } from "@shared/models/order";
import { isOrderFulfillmentStatus } from "@shared/models/order";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmPurchase";
const ORDER_BY_PRODUCT_INDEX = "byProductId";
const ORDER_BY_CUSTOMER_INDEX = "byCustomer";
const ORDER_BY_STATUS_INDEX = "byStatus";

type RawOrder = Record<string, unknown>;

type ProductOrderSummaryAggregate = {
  pendingQuantity: number;
  orderedQuantity: number;
  receivedQuantity: number;
  shippedQuantity: number;
  outOfStockQuantity: number;
  totalQuantity: number;
  latestActivityAt: string | null;
};

type CustomerOrderSummaryAggregate = {
  readyToShipOrderCount: number;
  receivedItemCount: number;
  latestReceivedAt: string | null;
  completedOrderCount: number;
  totalOrderCount: number;
};

type SupplierOrderSummaryAggregate = {
  orderedQuantity: number;
  receivedQuantity: number;
  totalQuantity: number;
  latestActivityAt: string | null;
};

function toInteger(value: unknown): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function toTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

function withPurchaseApplied(
  order: RawOrder,
  {
    orderId,
    supplierName,
    purchasedAt,
  }: {
    orderId: string;
    supplierName: string;
    purchasedAt: string;
  },
): RawOrder {
  if (String(order["id"] ?? "") !== orderId) {
    return order;
  }

  return {
    ...order,
    status: "ORDERED",
    supplierName,
    purchasedAt,
    updatedAt: purchasedAt,
  };
}

function getLatestActivityAt(order: RawOrder): string | null {
  const value =
    order["updatedAt"] ??
    order["receivedAt"] ??
    order["purchasedAt"] ??
    order["createdAtForSort"] ??
    order["createdAt"] ??
    null;

  return value != null ? String(value) : null;
}

function isActiveOrder(order: RawOrder): boolean {
  return order["isActive"] !== false && order["deletedAt"] == null;
}

function mergeOrderForAggregation(
  orders: readonly RawOrder[],
  order: RawOrder,
): RawOrder[] {
  const byId = new Map<string, RawOrder>();

  for (const item of orders) {
    const id = String(item["id"] ?? "");
    if (id) {
      byId.set(id, item);
    }
  }

  byId.set(String(order["id"] ?? ""), order);

  return Array.from(byId.values());
}

async function queryOrdersByIndex({
  orderTable,
  indexName,
  keyName,
  keyValue,
}: {
  orderTable: string;
  indexName: string;
  keyName: string;
  keyValue: string;
}): Promise<RawOrder[]> {
  const orders: RawOrder[] = [];
  let lastEvaluatedKey: Record<string, AttributeValue> | undefined;

  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: orderTable,
        IndexName: indexName,
        KeyConditionExpression: "#key = :value",
        ExpressionAttributeNames: {
          "#key": keyName,
        },
        ExpressionAttributeValues: marshall({
          ":value": keyValue,
        }),
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    orders.push(
      ...(result.Items ?? []).map(
        (item) => unmarshall(item) as RawOrder,
      ),
    );
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return orders;
}

async function querySupplierOrders({
  orderTable,
  supplierName,
}: {
  orderTable: string;
  supplierName: string;
}): Promise<RawOrder[]> {
  const orders: RawOrder[] = [];

  for (const status of ["ORDERED", "RECEIVED"] as const) {
    let lastEvaluatedKey: Record<string, AttributeValue> | undefined;

    do {
      const result = await ddb.send(
        new QueryCommand({
          TableName: orderTable,
          IndexName: ORDER_BY_STATUS_INDEX,
          KeyConditionExpression: "#status = :status",
          FilterExpression: "#supplierName = :supplierName",
          ExpressionAttributeNames: {
            "#status": "status",
            "#supplierName": "supplierName",
          },
          ExpressionAttributeValues: marshall({
            ":status": status,
            ":supplierName": supplierName,
          }),
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      orders.push(
        ...(result.Items ?? []).map(
          (item) => unmarshall(item) as RawOrder,
        ),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }

  return orders;
}

async function getSummary(
  tableName: string,
  id: string,
): Promise<RawOrder | null> {
  const result = await ddb.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ id }),
    }),
  );

  return result.Item ? (unmarshall(result.Item) as RawOrder) : null;
}

function aggregateProductOrderSummary(
  orders: readonly RawOrder[],
): ProductOrderSummaryAggregate {
  return orders.reduce<ProductOrderSummaryAggregate>(
    (acc, order) => {
      if (!isActiveOrder(order)) {
        return acc;
      }

      const status = String(order["status"] ?? "");
      const quantity = toInteger(order["quantity"]);
      const latestActivityAt = getLatestActivityAt(order);

      if (status === "PENDING") acc.pendingQuantity += quantity;
      if (status === "ORDERED") acc.orderedQuantity += quantity;
      if (status === "RECEIVED") acc.receivedQuantity += quantity;
      if (status === "SHIPPED") acc.shippedQuantity += quantity;
      if (status === "OUT_OF_STOCK") acc.outOfStockQuantity += quantity;
      if (status !== "CANCELLED") acc.totalQuantity += quantity;

      acc.latestActivityAt =
        latestActivityAt &&
        (!acc.latestActivityAt || latestActivityAt > acc.latestActivityAt)
          ? latestActivityAt
          : acc.latestActivityAt;

      return acc;
    },
    {
      pendingQuantity: 0,
      orderedQuantity: 0,
      receivedQuantity: 0,
      shippedQuantity: 0,
      outOfStockQuantity: 0,
      totalQuantity: 0,
      latestActivityAt: null,
    },
  );
}

function aggregateCustomerOrderSummary(
  orders: readonly RawOrder[],
): CustomerOrderSummaryAggregate {
  return orders.reduce<CustomerOrderSummaryAggregate>(
    (acc, order) => {
      if (!isActiveOrder(order)) {
        return acc;
      }

      const status = String(order["status"] ?? "");
      const quantity = toInteger(order["quantity"]);
      const receivedAt =
        order["receivedAt"] != null ? String(order["receivedAt"]) : null;

      if (status !== "CANCELLED") acc.totalOrderCount += 1;
      if (status === "RECEIVED") {
        acc.readyToShipOrderCount += 1;
        acc.receivedItemCount += quantity;
        acc.latestReceivedAt =
          receivedAt && (!acc.latestReceivedAt || receivedAt > acc.latestReceivedAt)
            ? receivedAt
            : acc.latestReceivedAt;
      }
      if (status === "COMPLETED") acc.completedOrderCount += 1;

      return acc;
    },
    {
      readyToShipOrderCount: 0,
      receivedItemCount: 0,
      latestReceivedAt: null,
      completedOrderCount: 0,
      totalOrderCount: 0,
    },
  );
}

function aggregateSupplierOrderSummary(
  orders: readonly RawOrder[],
  supplierName: string,
): SupplierOrderSummaryAggregate {
  return orders.reduce<SupplierOrderSummaryAggregate>(
    (acc, order) => {
      if (!isActiveOrder(order) || toTrimmedString(order["supplierName"]) !== supplierName) {
        return acc;
      }

      const status = String(order["status"] ?? "");
      if (status !== "ORDERED" && status !== "RECEIVED") {
        return acc;
      }

      const quantity = toInteger(order["quantity"]);
      const latestActivityAt = getLatestActivityAt(order);

      if (status === "ORDERED") acc.orderedQuantity += quantity;
      if (status === "RECEIVED") acc.receivedQuantity += quantity;

      acc.totalQuantity += quantity;
      acc.latestActivityAt =
        latestActivityAt &&
        (!acc.latestActivityAt || latestActivityAt > acc.latestActivityAt)
          ? latestActivityAt
          : acc.latestActivityAt;

      return acc;
    },
    {
      orderedQuantity: 0,
      receivedQuantity: 0,
      totalQuantity: 0,
      latestActivityAt: null,
    },
  );
}

function summaryCreatedAt(existingSummary: RawOrder | null, now: string): string {
  return String(
    existingSummary?.["createdAtForSort"] ?? existingSummary?.["createdAt"] ?? now,
  );
}

/**
 * 確認採購 Lambda 函式
 *
 * 將 Order 的 status 從 PENDING 轉換為 ORDERED，
 * 記錄 purchasedAt 與 supplierName，並附加 statusHistory 記錄。
 *
 * 需求：2.5, 3.2, 3.9
 */
export const handler: Schema["confirmPurchase"]["functionHandler"] = async (
  event,
) => {
  const { orderId, supplierName } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderId, supplierName });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const customerSummaryTable =
    process.env["CUSTOMER_ORDER_SUMMARY_TABLE_NAME"];
  const productSummaryTable = process.env["PRODUCT_ORDER_SUMMARY_TABLE_NAME"];
  const supplierSummaryTable =
    process.env["SUPPLIER_ORDER_SUMMARY_TABLE_NAME"];

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
    // 1. 取得 Order 資料
    const orderResult = await ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
      }),
    );

    if (!orderResult.Item) {
      logWarn(FUNCTION_NAME, "order not found", { orderId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的訂單",
      });
    }

    const order = unmarshall(orderResult.Item);
    const rawStatus = order["status"];
    const productId = toTrimmedString(order["productId"]);
    const customerId = toTrimmedString(order["customerId"]);
    const effectiveSupplierName =
      toTrimmedString(supplierName) || toTrimmedString(order["supplierName"]);
    logDebug(FUNCTION_NAME, "order loaded", {
      orderId,
      rawStatus,
      productId,
      customerId,
      supplierName: effectiveSupplierName,
    });

    if (!productId || !customerId) {
      return JSON.stringify({
        success: false,
        message: "訂單缺少客戶或商品關聯，無法確認採購",
      });
    }

    if (!effectiveSupplierName) {
      return JSON.stringify({
        success: false,
        message: "訂單缺少供應商，無法確認採購",
      });
    }

    // 2. 驗證目前狀態是否為合法的 OrderFulfillmentStatus
    if (!isOrderFulfillmentStatus(rawStatus)) {
      logWarn(FUNCTION_NAME, "invalid order status", { orderId, rawStatus });
      return JSON.stringify({
        success: false,
        message: "訂單狀態無法識別，無法確認採購",
      });
    }

    const currentStatus: OrderFulfillmentStatus = rawStatus;
    const targetStatus: OrderFulfillmentStatus = "ORDERED";

    // 3. 使用共用邏輯驗證狀態轉換合法性（PENDING → ORDERED）
    if (!isValidOrderStatusTransition(currentStatus, targetStatus)) {
      logWarn(FUNCTION_NAME, "invalid status transition", {
        orderId,
        currentStatus,
        targetStatus,
      });
      return JSON.stringify({
        success: false,
        message: `無法從「${currentStatus}」狀態確認採購，僅「PENDING」狀態可確認採購`,
      });
    }

    const now = new Date().toISOString();
    const purchasedOrder = {
      ...order,
      id: orderId,
      status: targetStatus,
      supplierName: effectiveSupplierName,
      purchasedAt: now,
      updatedAt: now,
    };
    const productOrders = mergeOrderForAggregation(
      (
        await queryOrdersByIndex({
          orderTable,
          indexName: ORDER_BY_PRODUCT_INDEX,
          keyName: "productId",
          keyValue: productId,
        })
      ).map((item) =>
        withPurchaseApplied(item, {
          orderId,
          supplierName: effectiveSupplierName,
          purchasedAt: now,
        }),
      ),
      purchasedOrder,
    );
    const customerOrders = mergeOrderForAggregation(
      (
        await queryOrdersByIndex({
          orderTable,
          indexName: ORDER_BY_CUSTOMER_INDEX,
          keyName: "customerId",
          keyValue: customerId,
        })
      ).map((item) =>
        withPurchaseApplied(item, {
          orderId,
          supplierName: effectiveSupplierName,
          purchasedAt: now,
        }),
      ),
      purchasedOrder,
    );
    const supplierOrders = mergeOrderForAggregation(
      await querySupplierOrders({
        orderTable,
        supplierName: effectiveSupplierName,
      }),
      purchasedOrder,
    );
    const [
      existingProductSummary,
      existingCustomerSummary,
      existingSupplierSummary,
    ] = await Promise.all([
      getSummary(productSummaryTable, productId),
      getSummary(customerSummaryTable, customerId),
      getSummary(supplierSummaryTable, effectiveSupplierName),
    ]);
    const productSummary = aggregateProductOrderSummary(productOrders);
    const customerSummary = aggregateCustomerOrderSummary(customerOrders);
    const supplierSummary = aggregateSupplierOrderSummary(
      supplierOrders,
      effectiveSupplierName,
    );
    const productSummaryCreatedAt = summaryCreatedAt(existingProductSummary, now);
    const customerSummaryCreatedAt = summaryCreatedAt(
      existingCustomerSummary,
      now,
    );
    const supplierSummaryCreatedAt = summaryCreatedAt(
      existingSupplierSummary,
      now,
    );

    // 4. 建立 statusHistory 記錄
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

    // 5. 執行交易：status → ORDERED + purchasedAt + supplierName + statusHistory
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      currentStatus,
      targetStatus,
      supplierName,
    });

    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: orderTable,
              Key: marshall({ id: orderId }),
              UpdateExpression:
                "SET #st = :newStatus, purchasedAt = :now, supplierName = :supplierName, statusHistory = :history, updatedAt = :now",
              ConditionExpression: "#st = :expectedStatus",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":newStatus": targetStatus,
                ":expectedStatus": currentStatus,
                ":now": now,
                ":supplierName": effectiveSupplierName,
                ":history": updatedHistory,
              }),
            },
          },
          {
            Put: {
              TableName: productSummaryTable,
              Item: marshall({
                id: productId,
                productId,
                productNameSnapshot: String(
                  order["productNameSnapshot"] ?? "未命名商品",
                ),
                productImageUrlSnapshot:
                  order["productImageUrlSnapshot"] ?? null,
                priceSnapshot: toInteger(order["unitPriceSnapshot"]),
                costSnapshot: toInteger(order["unitCostSnapshot"]),
                supplierNameSnapshot: effectiveSupplierName,
                pendingQuantity: productSummary.pendingQuantity,
                orderedQuantity: productSummary.orderedQuantity,
                receivedQuantity: productSummary.receivedQuantity,
                shippedQuantity: productSummary.shippedQuantity,
                outOfStockQuantity: productSummary.outOfStockQuantity,
                completedQuantity: 0,
                cancelledQuantity: 0,
                totalQuantity: productSummary.totalQuantity,
                latestActivityAt: productSummary.latestActivityAt,
                gsiPartition: "ProductOrderSummary",
                createdAt: productSummaryCreatedAt,
                createdAtForSort: productSummaryCreatedAt,
                updatedAt: now,
              }),
            },
          },
          {
            Put: {
              TableName: customerSummaryTable,
              Item: marshall({
                id: customerId,
                customerId,
                customerNameSnapshot: String(
                  order["customerNameSnapshot"] ?? "未命名客戶",
                ),
                readyToShipOrderCount:
                  customerSummary.readyToShipOrderCount,
                receivedItemCount: customerSummary.receivedItemCount,
                latestReceivedAt: customerSummary.latestReceivedAt,
                completedOrderCount: customerSummary.completedOrderCount,
                totalOrderCount: customerSummary.totalOrderCount,
                gsiPartition: "CustomerOrderSummary",
                createdAt: customerSummaryCreatedAt,
                createdAtForSort: customerSummaryCreatedAt,
                updatedAt: now,
              }),
            },
          },
          {
            Put: {
              TableName: supplierSummaryTable,
              Item: marshall({
                id: effectiveSupplierName,
                supplierNameSnapshot: effectiveSupplierName,
                orderedQuantity: supplierSummary.orderedQuantity,
                receivedQuantity: supplierSummary.receivedQuantity,
                totalQuantity: supplierSummary.totalQuantity,
                latestActivityAt: supplierSummary.latestActivityAt,
                gsiPartition: "SupplierOrderSummary",
                createdAt: supplierSummaryCreatedAt,
                createdAtForSort: supplierSummaryCreatedAt,
                updatedAt: now,
              }),
            },
          },
        ],
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      status: targetStatus,
      supplierName: effectiveSupplierName,
      purchasedAt: now,
    });

    return JSON.stringify({
      success: true,
      message: "確認採購成功",
      data: {
        orderId,
        status: targetStatus,
        supplierName: effectiveSupplierName,
        purchasedAt: now,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        orderId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "確認採購失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderId });
    return JSON.stringify({
      success: false,
      message: `確認採購失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
