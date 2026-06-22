import {
  type AttributeValue,
  type DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  type TransactWriteItem,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ORDER_BY_PRODUCT_INDEX = "byProductId";
const ORDER_BY_CUSTOMER_INDEX = "byCustomer";
const ORDER_BY_STATUS_INDEX = "byStatus";

export type RawOrder = Record<string, unknown>;

export type OrderSummaryChange = {
  before: RawOrder;
  after: RawOrder;
};

export type OrderSummaryTables = {
  orderTable: string;
  customerSummaryTable: string;
  productSummaryTable: string;
  supplierSummaryTable: string;
};

type ProductOrderSummaryAggregate = {
  pendingQuantity: number;
  orderedQuantity: number;
  receivedQuantity: number;
  shippedQuantity: number;
  outOfStockQuantity: number;
  completedQuantity: number;
  cancelledQuantity: number;
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

function getLatestActivityAt(order: RawOrder): string | null {
  const value =
    order["updatedAt"] ??
    order["completedAt"] ??
    order["shippedAt"] ??
    order["receivedAt"] ??
    order["outOfStockAt"] ??
    order["purchasedAt"] ??
    order["createdAtForSort"] ??
    order["createdAt"] ??
    null;

  return value != null ? String(value) : null;
}

function isActiveOrder(order: RawOrder): boolean {
  return order["isActive"] !== false && order["deletedAt"] == null;
}

function mergeOrdersForAggregation(
  orders: readonly RawOrder[],
  overrides: ReadonlyMap<string, RawOrder>,
): RawOrder[] {
  const byId = new Map<string, RawOrder>();

  for (const item of orders) {
    const id = toTrimmedString(item["id"]);
    if (id) {
      byId.set(id, overrides.get(id) ?? item);
    }
  }

  for (const [id, order] of overrides) {
    byId.set(id, order);
  }

  return Array.from(byId.values());
}

async function queryOrdersByIndex({
  ddb,
  orderTable,
  indexName,
  keyName,
  keyValue,
}: {
  ddb: DynamoDBClient;
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
      ...(result.Items ?? []).map((item) => unmarshall(item) as RawOrder),
    );
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return orders;
}

async function querySupplierOrders({
  ddb,
  orderTable,
  supplierName,
}: {
  ddb: DynamoDBClient;
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
        ...(result.Items ?? []).map((item) => unmarshall(item) as RawOrder),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }

  return orders;
}

async function getSummary({
  ddb,
  tableName,
  id,
}: {
  ddb: DynamoDBClient;
  tableName: string;
  id: string;
}): Promise<RawOrder | null> {
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
      if (status === "COMPLETED") acc.completedQuantity += quantity;
      if (status === "CANCELLED") acc.cancelledQuantity += quantity;
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
      completedQuantity: 0,
      cancelledQuantity: 0,
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
          receivedAt &&
          (!acc.latestReceivedAt || receivedAt > acc.latestReceivedAt)
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
      if (
        !isActiveOrder(order) ||
        toTrimmedString(order["supplierName"]) !== supplierName
      ) {
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

function summaryCreatedAt(
  existingSummary: RawOrder | null,
  now: string,
): string {
  return String(
    existingSummary?.["createdAtForSort"] ??
      existingSummary?.["createdAt"] ??
      now,
  );
}

function firstOrderForEntity(
  orders: readonly RawOrder[],
  idField: "productId" | "customerId",
  id: string,
): RawOrder | undefined {
  return orders.find((order) => toTrimmedString(order[idField]) === id);
}

function affectedValues(
  changes: readonly OrderSummaryChange[],
  field: "productId" | "customerId" | "supplierName",
): string[] {
  return Array.from(
    new Set(
      changes
        .flatMap(({ before, after }) => [
          toTrimmedString(before[field]),
          toTrimmedString(after[field]),
        ])
        .filter(Boolean),
    ),
  );
}

export async function buildOrderSummaryTransactItems({
  ddb,
  tables,
  changes,
  now,
}: {
  ddb: DynamoDBClient;
  tables: OrderSummaryTables;
  changes: readonly OrderSummaryChange[];
  now: string;
}): Promise<TransactWriteItem[]> {
  const overrides = new Map<string, RawOrder>();
  for (const { after } of changes) {
    const id = toTrimmedString(after["id"]);
    if (id) {
      overrides.set(id, after);
    }
  }

  const productIds = affectedValues(changes, "productId");
  const customerIds = affectedValues(changes, "customerId");
  const supplierNames = affectedValues(changes, "supplierName");
  const items: TransactWriteItem[] = [];

  for (const productId of productIds) {
    const orders = mergeOrdersForAggregation(
      await queryOrdersByIndex({
        ddb,
        orderTable: tables.orderTable,
        indexName: ORDER_BY_PRODUCT_INDEX,
        keyName: "productId",
        keyValue: productId,
      }),
      overrides,
    );
    const existingSummary = await getSummary({
      ddb,
      tableName: tables.productSummaryTable,
      id: productId,
    });
    const aggregate = aggregateProductOrderSummary(orders);
    const snapshotOrder =
      firstOrderForEntity(orders, "productId", productId) ??
      changes.find(
        ({ before, after }) =>
          toTrimmedString(before["productId"]) === productId ||
          toTrimmedString(after["productId"]) === productId,
      )?.after;
    const createdAt = summaryCreatedAt(existingSummary, now);

    items.push({
      Put: {
        TableName: tables.productSummaryTable,
        Item: marshall({
          id: productId,
          productId,
          productNameSnapshot: String(
            snapshotOrder?.["productNameSnapshot"] ??
              existingSummary?.["productNameSnapshot"] ??
              "未命名商品",
          ),
          productSkuSnapshot: String(
            snapshotOrder?.["productSkuSnapshot"] ??
              existingSummary?.["productSkuSnapshot"] ??
              "",
          ),
          productImageUrlSnapshot:
            snapshotOrder?.["productImageUrlSnapshot"] ??
            existingSummary?.["productImageUrlSnapshot"] ??
            null,
          priceSnapshot: toInteger(
            snapshotOrder?.["unitPriceSnapshot"] ??
              existingSummary?.["priceSnapshot"],
          ),
          costSnapshot: toInteger(
            snapshotOrder?.["unitCostSnapshot"] ??
              existingSummary?.["costSnapshot"],
          ),
          supplierNameSnapshot:
            toTrimmedString(snapshotOrder?.["supplierName"]) ||
            existingSummary?.["supplierNameSnapshot"] ||
            null,
          pendingQuantity: aggregate.pendingQuantity,
          orderedQuantity: aggregate.orderedQuantity,
          receivedQuantity: aggregate.receivedQuantity,
          shippedQuantity: aggregate.shippedQuantity,
          outOfStockQuantity: aggregate.outOfStockQuantity,
          completedQuantity: aggregate.completedQuantity,
          cancelledQuantity: aggregate.cancelledQuantity,
          totalQuantity: aggregate.totalQuantity,
          latestActivityAt: aggregate.latestActivityAt,
          gsiPartition: "ProductOrderSummary",
          createdAt,
          createdAtForSort: createdAt,
          updatedAt: now,
        }),
      },
    });
  }

  for (const customerId of customerIds) {
    const orders = mergeOrdersForAggregation(
      await queryOrdersByIndex({
        ddb,
        orderTable: tables.orderTable,
        indexName: ORDER_BY_CUSTOMER_INDEX,
        keyName: "customerId",
        keyValue: customerId,
      }),
      overrides,
    );
    const existingSummary = await getSummary({
      ddb,
      tableName: tables.customerSummaryTable,
      id: customerId,
    });
    const aggregate = aggregateCustomerOrderSummary(orders);
    const snapshotOrder =
      firstOrderForEntity(orders, "customerId", customerId) ??
      changes.find(
        ({ before, after }) =>
          toTrimmedString(before["customerId"]) === customerId ||
          toTrimmedString(after["customerId"]) === customerId,
      )?.after;
    const createdAt = summaryCreatedAt(existingSummary, now);

    items.push({
      Put: {
        TableName: tables.customerSummaryTable,
        Item: marshall({
          id: customerId,
          customerId,
          customerNameSnapshot: String(
            snapshotOrder?.["customerNameSnapshot"] ??
              existingSummary?.["customerNameSnapshot"] ??
              "未命名客戶",
          ),
          readyToShipOrderCount: aggregate.readyToShipOrderCount,
          receivedItemCount: aggregate.receivedItemCount,
          latestReceivedAt: aggregate.latestReceivedAt,
          completedOrderCount: aggregate.completedOrderCount,
          totalOrderCount: aggregate.totalOrderCount,
          gsiPartition: "CustomerOrderSummary",
          createdAt,
          createdAtForSort: createdAt,
          updatedAt: now,
        }),
      },
    });
  }

  for (const supplierName of supplierNames) {
    const orders = mergeOrdersForAggregation(
      await querySupplierOrders({
        ddb,
        orderTable: tables.orderTable,
        supplierName,
      }),
      overrides,
    );
    const existingSummary = await getSummary({
      ddb,
      tableName: tables.supplierSummaryTable,
      id: supplierName,
    });
    const aggregate = aggregateSupplierOrderSummary(orders, supplierName);
    const createdAt = summaryCreatedAt(existingSummary, now);

    if (aggregate.totalQuantity === 0 && existingSummary) {
      items.push({
        Delete: {
          TableName: tables.supplierSummaryTable,
          Key: marshall({ id: supplierName }),
        },
      });
      continue;
    }

    if (aggregate.totalQuantity === 0) {
      continue;
    }

    items.push({
      Put: {
        TableName: tables.supplierSummaryTable,
        Item: marshall({
          id: supplierName,
          supplierNameSnapshot: supplierName,
          orderedQuantity: aggregate.orderedQuantity,
          receivedQuantity: aggregate.receivedQuantity,
          totalQuantity: aggregate.totalQuantity,
          latestActivityAt: aggregate.latestActivityAt,
          gsiPartition: "SupplierOrderSummary",
          createdAt,
          createdAtForSort: createdAt,
          updatedAt: now,
        }),
      },
    });
  }

  return items;
}
