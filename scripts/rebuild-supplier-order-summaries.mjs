import { readFile } from "node:fs/promises";
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { assertLocalDemoScriptEnvironment } from "./demo-script-guard.mjs";
import { buildSupplierOrderSummariesFromOrders } from "./supplier-order-summary-lib.mjs";

const REQUIRED_CONFIRMATION = "REBUILD_SUPPLIER_SUMMARIES";
const BATCH_SIZE = 25;
const MAX_BATCH_RETRIES = 5;

function parseArgs(argv) {
  const args = {
    dryRun: false,
    confirmed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const nextValue = argv[index + 1];

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token === "--confirm" && nextValue === REQUIRED_CONFIRMATION) {
      args.confirmed = true;
      index += 1;
    }
  }

  return args;
}

async function loadTableNames() {
  const raw = await readFile(
    new URL("../amplify_outputs.json", import.meta.url),
    "utf8",
  );
  const outputs = JSON.parse(raw);
  const customTables = outputs?.custom?.tables ?? {};

  const tableNames = {
    order: customTables.Order?.tableName ?? null,
    supplierOrderSummary:
      customTables.SupplierOrderSummary?.tableName ?? null,
  };

  for (const [key, value] of Object.entries(tableNames)) {
    if (!value) {
      throw new Error(`找不到資料表名稱：${key}`);
    }
  }

  return tableNames;
}

async function scanAll(ddb, tableName) {
  const items = [];
  let lastEvaluatedKey;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
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

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function batchWriteWithRetry(ddb, requestItems) {
  let pendingRequestItems = requestItems;

  for (let attempt = 0; Object.keys(pendingRequestItems).length > 0; attempt += 1) {
    if (attempt > MAX_BATCH_RETRIES) {
      throw new Error("批次寫入失敗，仍有未完成請求");
    }

    const result = await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: pendingRequestItems,
      }),
    );

    pendingRequestItems = result.UnprocessedItems ?? {};

    if (Object.keys(pendingRequestItems).length > 0) {
      await sleep(100 * 2 ** attempt);
    }
  }
}

async function replaceSummaryTable(ddb, tableName, idsToDelete, summaries) {
  const deleteChunks = chunkArray(idsToDelete, BATCH_SIZE);

  for (const chunk of deleteChunks) {
    await batchWriteWithRetry(ddb, {
      [tableName]: chunk.map((id) => ({
        DeleteRequest: {
          Key: marshall({ id }),
        },
      })),
    });
  }

  const putChunks = chunkArray(summaries, BATCH_SIZE);

  for (const chunk of putChunks) {
    await batchWriteWithRetry(ddb, {
      [tableName]: chunk.map((summary) => ({
        PutRequest: {
          Item: marshall(summary, { removeUndefinedValues: true }),
        },
      })),
    });
  }
}

function createEmptySummary() {
  return {
    orderedQuantity: 0,
    receivedQuantity: 0,
    totalQuantity: 0,
  };
}

function validateSummaryConsistency({ orders, summaries }) {
  const expected = new Map();

  for (const item of orders) {
    const supplierName = String(item.supplierName ?? "").trim();
    const status = String(item.status ?? "");

    if (!supplierName || (status !== "ORDERED" && status !== "RECEIVED")) {
      continue;
    }

    const quantity = Number(item.quantity ?? 0);
    const current = expected.get(supplierName) ?? createEmptySummary();

    if (status === "ORDERED") {
      current.orderedQuantity += quantity;
    }

    if (status === "RECEIVED") {
      current.receivedQuantity += quantity;
    }

    current.totalQuantity += quantity;
    expected.set(supplierName, current);
  }

  for (const summary of summaries) {
    const supplierName = String(
      summary.supplierNameSnapshot ?? summary.id ?? "",
    ).trim();
    const current = expected.get(supplierName) ?? createEmptySummary();

    for (const field of [
      "orderedQuantity",
      "receivedQuantity",
      "totalQuantity",
    ]) {
      if (Number(summary[field] ?? 0) !== Number(current[field] ?? 0)) {
        throw new Error(
          `供應商摘要 ${supplierName} 的 ${field} 與 Order 聚合結果不一致`,
        );
      }
    }
  }
}

async function main() {
  await assertLocalDemoScriptEnvironment();
  const args = parseArgs(process.argv.slice(2));

  if (!args.confirmed && !args.dryRun) {
    console.error(
      [
        "這個腳本會重建 SupplierOrderSummary 摘要資料。",
        "它會先清空摘要表，再依現有 Order 重新計算。",
        `若確定要執行，請加上：--confirm ${REQUIRED_CONFIRMATION}`,
      ].join("\n"),
    );
    process.exit(1);
  }

  const tableNames = await loadTableNames();
  const ddb = new DynamoDBClient({});
  const [orders, existingSummaries] = await Promise.all([
    scanAll(ddb, tableNames.order),
    scanAll(ddb, tableNames.supplierOrderSummary),
  ]);

  const summaries = buildSupplierOrderSummariesFromOrders({
    orders,
  });
  validateSummaryConsistency({ orders, summaries });
  const existingSummaryIds = existingSummaries
    .map((summary) => String(summary.id ?? ""))
    .filter(Boolean);

  if (!args.dryRun) {
    await replaceSummaryTable(
      ddb,
      tableNames.supplierOrderSummary,
      existingSummaryIds,
      summaries,
    );
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        dryRun: args.dryRun,
        confirmation: args.confirmed,
        orderCount: orders.length,
        deletedSummaryCount: existingSummaryIds.length,
        rebuiltSummaryCount: summaries.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("重建 SupplierOrderSummary 失敗");
  console.error(error);
  process.exit(1);
});
