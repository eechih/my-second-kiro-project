import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  mapLegacyCounterToSequenceCounter,
  mapLegacyLineItemToOrderItem,
  mapLegacyOrderToCurrentShape,
  normalizeSearchName,
  resolveSortTimestamp,
  type LegacyLineItemRecord,
} from "./order-schema-migration-lib";

const TABLE_NAMES = {
  customer: process.env["CUSTOMER_TABLE_NAME"],
  supplier: process.env["SUPPLIER_TABLE_NAME"],
  product: process.env["PRODUCT_TABLE_NAME"],
  productVariant: process.env["PRODUCTVARIANT_TABLE_NAME"],
  order: process.env["ORDER_TABLE_NAME"],
  orderItem: process.env["ORDERITEM_TABLE_NAME"],
  sequenceCounter: process.env["SEQUENCECOUNTER_TABLE_NAME"],
  legacyLineItem: process.env["LEGACY_LINEITEM_TABLE_NAME"],
  legacyProductCounter: process.env["LEGACY_PRODUCTCOUNTER_TABLE_NAME"],
} as const;

const DRY_RUN = process.env["DRY_RUN"] === "1";

const REQUIRED_TABLES = [
  "customer",
  "supplier",
  "product",
  "productVariant",
  "order",
  "orderItem",
  "sequenceCounter",
] as const;

for (const key of REQUIRED_TABLES) {
  if (!TABLE_NAMES[key]) {
    console.error(`缺少環境變數：${key.toUpperCase()}_TABLE_NAME`);
    process.exit(1);
  }
}

const ddb = new DynamoDBClient({});

interface Stats {
  scanned: number;
  updated: number;
  created: number;
  skipped: number;
}

async function scanAll(
  tableName: string,
  projectionExpression?: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastEvaluatedKey:
    | Record<string, import("@aws-sdk/client-dynamodb").AttributeValue>
    | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: projectionExpression,
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    for (const item of result.Items ?? []) {
      items.push(unmarshall(item));
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

async function updateFields(
  tableName: string,
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  if (DRY_RUN || Object.keys(fields).length === 0) {
    return;
  }

  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const fragments = Object.entries(fields).map(([key, value], index) => {
    const nameKey = `#f${index}`;
    const valueKey = `:v${index}`;
    names[nameKey] = key;
    values[valueKey] = value;
    return `${nameKey} = ${valueKey}`;
  });

  await ddb.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ id }),
      UpdateExpression: `SET ${fragments.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: marshall(values, {
        removeUndefinedValues: true,
      }),
    }),
  );
}

async function itemExists(tableName: string, id: string): Promise<boolean> {
  const result = await ddb.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ id }),
      ProjectionExpression: "id",
    }),
  );

  return Boolean(result.Item);
}

async function backfillCustomers(): Promise<Stats> {
  const stats: Stats = { scanned: 0, updated: 0, created: 0, skipped: 0 };
  const items = await scanAll(TABLE_NAMES.customer!);

  for (const item of items) {
    stats.scanned += 1;
    const fields: Record<string, unknown> = {};

    if (item["note"] === undefined) fields.note = null;
    if (item["deletedAt"] === undefined) fields.deletedAt = null;
    if (item["gsiPartition"] === undefined) fields.gsiPartition = "Customer";
    if (item["createdAtForSort"] === undefined) {
      fields.createdAtForSort = resolveSortTimestamp({
        createdAt: typeof item["createdAt"] === "string" ? item["createdAt"] : null,
        updatedAt: typeof item["updatedAt"] === "string" ? item["updatedAt"] : null,
      });
    }

    if (Object.keys(fields).length === 0) {
      stats.skipped += 1;
      continue;
    }

    await updateFields(TABLE_NAMES.customer!, String(item["id"]), fields);
    stats.updated += 1;
  }

  return stats;
}

async function backfillSuppliers(): Promise<Stats> {
  const stats: Stats = { scanned: 0, updated: 0, created: 0, skipped: 0 };
  const items = await scanAll(TABLE_NAMES.supplier!);

  for (const item of items) {
    stats.scanned += 1;
    const fields: Record<string, unknown> = {};

    if (item["note"] === undefined) fields.note = null;
    if (item["deletedAt"] === undefined) fields.deletedAt = null;
    if (item["gsiPartition"] === undefined) fields.gsiPartition = "Supplier";
    if (item["createdAtForSort"] === undefined) {
      fields.createdAtForSort = resolveSortTimestamp({
        createdAt: typeof item["createdAt"] === "string" ? item["createdAt"] : null,
        updatedAt: typeof item["updatedAt"] === "string" ? item["updatedAt"] : null,
      });
    }

    if (Object.keys(fields).length === 0) {
      stats.skipped += 1;
      continue;
    }

    await updateFields(TABLE_NAMES.supplier!, String(item["id"]), fields);
    stats.updated += 1;
  }

  return stats;
}

async function backfillProducts(): Promise<Map<string, string>> {
  const items = await scanAll(TABLE_NAMES.product!);
  const skuMap = new Map<string, string>();

  for (const item of items) {
    const id = String(item["id"] ?? "");
    const sku = String(item["sku"] ?? "");
    skuMap.set(id, sku);

    const fields: Record<string, unknown> = {};
    if (item["searchName"] === undefined) {
      fields.searchName = normalizeSearchName(String(item["name"] ?? ""));
    }
    if (item["preorderStatus"] === undefined) fields.preorderStatus = "DRAFT";
    if (item["deletedAt"] === undefined) fields.deletedAt = null;
    if (item["gsiPartition"] === undefined) fields.gsiPartition = "Product";
    if (item["createdAtForSort"] === undefined) {
      fields.createdAtForSort = resolveSortTimestamp({
        createdAt: typeof item["createdAt"] === "string" ? item["createdAt"] : null,
        updatedAt: typeof item["updatedAt"] === "string" ? item["updatedAt"] : null,
      });
    }

    await updateFields(TABLE_NAMES.product!, id, fields);
  }

  return skuMap;
}

async function backfillProductVariants(): Promise<Stats> {
  const stats: Stats = { scanned: 0, updated: 0, created: 0, skipped: 0 };
  const items = await scanAll(TABLE_NAMES.productVariant!);

  for (const item of items) {
    stats.scanned += 1;
    const fields: Record<string, unknown> = {};

    if (item["priceOffset"] === undefined || item["priceOffset"] === null) {
      fields.priceOffset = 0;
    }
    if (item["costOffset"] === undefined || item["costOffset"] === null) {
      fields.costOffset = 0;
    }
    if (item["sortOrder"] === undefined) fields.sortOrder = 0;
    if (item["isActive"] === undefined) fields.isActive = true;
    if (item["deletedAt"] === undefined) fields.deletedAt = null;
    if (item["createdAtForSort"] === undefined) {
      fields.createdAtForSort = resolveSortTimestamp({
        createdAt: typeof item["createdAt"] === "string" ? item["createdAt"] : null,
        updatedAt: typeof item["updatedAt"] === "string" ? item["updatedAt"] : null,
      });
    }

    if (Object.keys(fields).length === 0) {
      stats.skipped += 1;
      continue;
    }

    await updateFields(TABLE_NAMES.productVariant!, String(item["id"]), fields);
    stats.updated += 1;
  }

  return stats;
}

async function backfillOrders(): Promise<Stats> {
  const stats: Stats = { scanned: 0, updated: 0, created: 0, skipped: 0 };
  const items = await scanAll(TABLE_NAMES.order!);

  for (const item of items) {
    stats.scanned += 1;
    const fields = mapLegacyOrderToCurrentShape(item);
    const diff: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(fields)) {
      if (item[key] === undefined) {
        diff[key] = value;
      }
    }

    if (Object.keys(diff).length === 0) {
      stats.skipped += 1;
      continue;
    }

    await updateFields(TABLE_NAMES.order!, String(item["id"]), diff);
    stats.updated += 1;
  }

  return stats;
}

async function migrateLegacyLineItems(productSkuMap: Map<string, string>): Promise<Stats> {
  const stats: Stats = { scanned: 0, updated: 0, created: 0, skipped: 0 };
  if (!TABLE_NAMES.legacyLineItem) {
    return stats;
  }

  const items = await scanAll(TABLE_NAMES.legacyLineItem!);

  for (const rawItem of items) {
    stats.scanned += 1;
    const lineItem = rawItem as unknown as LegacyLineItemRecord;
    const exists = await itemExists(TABLE_NAMES.orderItem!, lineItem.id);
    if (exists) {
      stats.skipped += 1;
      continue;
    }

    const nextItem = mapLegacyLineItemToOrderItem(
      lineItem,
      productSkuMap.get(lineItem.productId) ?? "",
    );

    if (!DRY_RUN) {
      await ddb.send(
        new PutItemCommand({
          TableName: TABLE_NAMES.orderItem!,
          Item: marshall(nextItem, { removeUndefinedValues: true }),
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );
    }

    stats.created += 1;
  }

  return stats;
}

async function migrateLegacyCounters(): Promise<Stats> {
  const stats: Stats = { scanned: 0, updated: 0, created: 0, skipped: 0 };
  if (!TABLE_NAMES.legacyProductCounter) {
    return stats;
  }

  const items = await scanAll(TABLE_NAMES.legacyProductCounter!);

  for (const item of items) {
    stats.scanned += 1;
    const nextCounter = mapLegacyCounterToSequenceCounter(item);
    const exists = await itemExists(
      TABLE_NAMES.sequenceCounter!,
      String(nextCounter["id"]),
    );

    if (exists) {
      stats.skipped += 1;
      continue;
    }

    if (!DRY_RUN) {
      await ddb.send(
        new PutItemCommand({
          TableName: TABLE_NAMES.sequenceCounter!,
          Item: marshall(nextCounter, { removeUndefinedValues: true }),
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );
    }

    stats.created += 1;
  }

  return stats;
}

function printStats(label: string, stats: Stats): void {
  console.log(
    `${label}: 掃描 ${stats.scanned}，更新 ${stats.updated}，建立 ${stats.created}，跳過 ${stats.skipped}`,
  );
}

async function main(): Promise<void> {
  console.log("=== 開始新版 schema migration ===");
  console.log(`DRY_RUN=${DRY_RUN ? "1" : "0"}`);

  const customerStats = await backfillCustomers();
  const supplierStats = await backfillSuppliers();
  const productSkuMap = await backfillProducts();
  const variantStats = await backfillProductVariants();
  const orderStats = await backfillOrders();
  const orderItemStats = await migrateLegacyLineItems(productSkuMap);
  const counterStats = await migrateLegacyCounters();

  printStats("Customer", customerStats);
  printStats("Supplier", supplierStats);
  printStats("ProductVariant", variantStats);
  printStats("Order", orderStats);
  printStats("OrderItem", orderItemStats);
  printStats("SequenceCounter", counterStats);
}

main().catch((error: unknown) => {
  console.error("migration 失敗", error);
  process.exit(1);
});
