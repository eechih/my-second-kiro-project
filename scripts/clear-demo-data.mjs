import { readFile } from "node:fs/promises";
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { assertLocalDemoScriptEnvironment } from "./demo-script-guard.mjs";

const REQUIRED_CONFIRMATION = "DELETE_ALL_DATA";
const BATCH_SIZE = 25;
const MAX_BATCH_RETRIES = 5;
const SUMMARY_ONLY_MODE = "summary-only";

const TABLE_DELETE_ORDER = [
  "CustomerOrderSummary",
  "ProductOrderSummary",
  "OrderItem",
  "Order",
  "ProductOptionValue",
  "ProductOption",
  "Product",
  "Supplier",
  "Customer",
  "SequenceCounter",
];

function parseArgs(argv) {
  const args = {
    dryRun: false,
    confirmed: false,
    onlySummary: false,
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
      continue;
    }

    if (token === "--only" && nextValue === SUMMARY_ONLY_MODE) {
      args.onlySummary = true;
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

  const tableNames = Object.fromEntries(
    TABLE_DELETE_ORDER.map((key) => [key, customTables[key]?.tableName ?? null]),
  );

  for (const [key, value] of Object.entries(tableNames)) {
    if (!value) {
      throw new Error(`找不到資料表名稱：${key}`);
    }
  }

  return tableNames;
}

async function scanIds(ddb, tableName) {
  const ids = [];
  let lastEvaluatedKey;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: "id",
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    for (const item of result.Items ?? []) {
      const record = unmarshall(item);
      if (record.id) {
        ids.push(String(record.id));
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return ids;
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

async function batchDeleteWithRetry(ddb, tableName, ids) {
  let pendingRequests = ids.map((id) => ({
    DeleteRequest: {
      Key: marshall({ id }),
    },
  }));

  for (let attempt = 0; pendingRequests.length > 0; attempt += 1) {
    if (attempt > MAX_BATCH_RETRIES) {
      throw new Error(
        `${tableName} 批次刪除失敗，仍有 ${pendingRequests.length} 筆未完成`,
      );
    }

    const result = await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: pendingRequests,
        },
      }),
    );

    pendingRequests = result.UnprocessedItems?.[tableName] ?? [];

    if (pendingRequests.length > 0) {
      await sleep(100 * 2 ** attempt);
    }
  }
}

async function deleteIds(ddb, tableName, ids, dryRun) {
  if (dryRun || ids.length === 0) {
    return;
  }

  const chunks = chunkArray(ids, BATCH_SIZE);

  for (const chunk of chunks) {
    await batchDeleteWithRetry(ddb, tableName, chunk);
  }
}

async function main() {
  await assertLocalDemoScriptEnvironment();
  const args = parseArgs(process.argv.slice(2));
  const modelsToClear = args.onlySummary
    ? ["CustomerOrderSummary"]
    : TABLE_DELETE_ORDER;

  if (!args.confirmed && !args.dryRun) {
    console.error(
      args.onlySummary
        ? [
            "這個腳本會清除 CustomerOrderSummary 摘要資料。",
            `若確定要執行，請加上：--confirm ${REQUIRED_CONFIRMATION}`,
          ].join("\n")
        : [
            "這個腳本會清除 Customer、Supplier、Product、ProductOption、ProductOptionValue、Order、OrderItem、SequenceCounter 全部資料。",
            "另外也會清除 CustomerOrderSummary 摘要資料。",
            `若確定要執行，請加上：--confirm ${REQUIRED_CONFIRMATION}`,
          ].join("\n"),
    );
    process.exit(1);
  }

  const tableNames = await loadTableNames();
  const ddb = new DynamoDBClient({});
  const scannedEntries = await Promise.all(
    modelsToClear.map(async (logicalName) => {
      const tableName = tableNames[logicalName];
      const ids = await scanIds(ddb, tableName);
      return { logicalName, tableName, ids };
    }),
  );

  const entriesByModel = Object.fromEntries(
    scannedEntries.map((entry) => [entry.logicalName, entry]),
  );

  if (!args.onlySummary) {
    await deleteIds(
      ddb,
      entriesByModel["CustomerOrderSummary"].tableName,
      entriesByModel["CustomerOrderSummary"].ids,
      args.dryRun,
    );

    await Promise.all([
      deleteIds(
        ddb,
        entriesByModel["OrderItem"].tableName,
        entriesByModel["OrderItem"].ids,
        args.dryRun,
      ),
      deleteIds(
        ddb,
        entriesByModel["ProductOptionValue"].tableName,
        entriesByModel["ProductOptionValue"].ids,
        args.dryRun,
      ),
    ]);

    await Promise.all([
      deleteIds(
        ddb,
        entriesByModel["Order"].tableName,
        entriesByModel["Order"].ids,
        args.dryRun,
      ),
      deleteIds(
        ddb,
        entriesByModel["ProductOption"].tableName,
        entriesByModel["ProductOption"].ids,
        args.dryRun,
      ),
    ]);

    await Promise.all([
      deleteIds(
        ddb,
        entriesByModel["Product"].tableName,
        entriesByModel["Product"].ids,
        args.dryRun,
      ),
      deleteIds(
        ddb,
        entriesByModel["Supplier"].tableName,
        entriesByModel["Supplier"].ids,
        args.dryRun,
      ),
      deleteIds(
        ddb,
        entriesByModel["Customer"].tableName,
        entriesByModel["Customer"].ids,
        args.dryRun,
      ),
      deleteIds(
        ddb,
        entriesByModel["SequenceCounter"].tableName,
        entriesByModel["SequenceCounter"].ids,
        args.dryRun,
      ),
    ]);
  } else {
    await deleteIds(
      ddb,
      entriesByModel["CustomerOrderSummary"].tableName,
      entriesByModel["CustomerOrderSummary"].ids,
      args.dryRun,
    );
  }

  const summary = scannedEntries.map(({ logicalName, tableName, ids }) => ({
    model: logicalName,
    tableName,
    deletedCount: ids.length,
  }));

  console.log(
    JSON.stringify(
      {
        success: true,
        dryRun: args.dryRun,
        confirmation: args.confirmed,
        onlySummary: args.onlySummary,
        summary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("清除資料失敗");
  console.error(error);
  process.exit(1);
});
