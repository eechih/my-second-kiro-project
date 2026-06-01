import { readFile } from "node:fs/promises";
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const REQUIRED_CONFIRMATION = "DELETE_ALL_DATA";
const BATCH_SIZE = 25;

const TABLE_DELETE_ORDER = [
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

async function deleteIds(ddb, tableName, ids, dryRun) {
  if (dryRun || ids.length === 0) {
    return;
  }

  for (let index = 0; index < ids.length; index += BATCH_SIZE) {
    const chunk = ids.slice(index, index + BATCH_SIZE);
    await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: chunk.map((id) => ({
            DeleteRequest: {
              Key: marshall({ id }),
            },
          })),
        },
      }),
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.confirmed && !args.dryRun) {
    console.error(
      [
        "這個腳本會清除 Customer、Supplier、Product、ProductOption、ProductOptionValue、Order、OrderItem、SequenceCounter 全部資料。",
        `若確定要執行，請加上：--confirm ${REQUIRED_CONFIRMATION}`,
      ].join("\n"),
    );
    process.exit(1);
  }

  const tableNames = await loadTableNames();
  const ddb = new DynamoDBClient({});
  const summary = [];

  for (const logicalName of TABLE_DELETE_ORDER) {
    const tableName = tableNames[logicalName];
    const ids = await scanIds(ddb, tableName);
    await deleteIds(ddb, tableName, ids, args.dryRun);
    summary.push({
      model: logicalName,
      tableName,
      deletedCount: ids.length,
    });
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        dryRun: args.dryRun,
        confirmation: args.confirmed,
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
