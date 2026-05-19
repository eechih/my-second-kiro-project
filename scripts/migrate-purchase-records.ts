/**
 * 資料遷移腳本：將 PurchaseRecord 的採購數據回填至 LineItem
 *
 * 此腳本讀取所有 PurchaseRecord，將 supplierId、supplierName、unitCost
 * 回填至對應的 LineItem。
 *
 * 特性：
 * - 冪等操作：重複執行不產生錯誤或重複資料
 * - 處理 DynamoDB scan 分頁（每次最多 1MB）
 * - 跳過已遷移的 LineItem（supplierId 已有值）
 * - 無 PurchaseRecord 的 LineItem 保持 null（不需額外處理）
 *
 * 環境變數：
 * - PURCHASERECORD_TABLE_NAME: PurchaseRecord DynamoDB 表名
 * - LINEITEM_TABLE_NAME: LineItem DynamoDB 表名
 *
 * 執行方式：
 *   npx tsx scripts/migrate-purchase-records.ts
 *
 * 需求：9.1, 9.2, 9.3, 9.4
 */

import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------

const PURCHASERECORD_TABLE_NAME = process.env["PURCHASERECORD_TABLE_NAME"];
const LINEITEM_TABLE_NAME = process.env["LINEITEM_TABLE_NAME"];

if (!PURCHASERECORD_TABLE_NAME || !LINEITEM_TABLE_NAME) {
  console.error(
    "錯誤：請設定環境變數 PURCHASERECORD_TABLE_NAME 與 LINEITEM_TABLE_NAME",
  );
  process.exit(1);
}

const ddb = new DynamoDBClient({});

// ---------------------------------------------------------------------------
// 型別
// ---------------------------------------------------------------------------

interface PurchaseRecordData {
  id: string;
  orderItemId: string;
  supplierId: string;
  supplierName: string;
  unitCost: number;
  status: string;
}

interface MigrationStats {
  totalScanned: number;
  updated: number;
  skipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// 主要邏輯
// ---------------------------------------------------------------------------

/**
 * 掃描 PurchaseRecord 表的所有記錄（處理分頁）
 */
async function scanAllPurchaseRecords(): Promise<PurchaseRecordData[]> {
  const records: PurchaseRecordData[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const command = new ScanCommand({
      TableName: PURCHASERECORD_TABLE_NAME,
      ExclusiveStartKey: lastEvaluatedKey as
        | Record<string, import("@aws-sdk/client-dynamodb").AttributeValue>
        | undefined,
    });

    const result = await ddb.send(command);

    if (result.Items) {
      for (const item of result.Items) {
        const record = unmarshall(item);
        records.push({
          id: record["id"] as string,
          orderItemId: record["orderItemId"] as string,
          supplierId: record["supplierId"] as string,
          supplierName: record["supplierName"] as string,
          unitCost: record["unitCost"] as number,
          status: record["status"] as string,
        });
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey
      ? (unmarshall(result.LastEvaluatedKey) as Record<string, unknown>)
      : undefined;
  } while (lastEvaluatedKey);

  return records;
}

/**
 * 檢查 LineItem 是否已遷移（supplierId 已有值）
 */
async function isAlreadyMigrated(orderItemId: string): Promise<boolean> {
  const result = await ddb.send(
    new GetItemCommand({
      TableName: LINEITEM_TABLE_NAME,
      Key: marshall({ id: orderItemId }),
      ProjectionExpression: "supplierId",
    }),
  );

  if (!result.Item) {
    return false;
  }

  const item = unmarshall(result.Item);
  return item["supplierId"] != null;
}

/**
 * 將 PurchaseRecord 的採購數據回填至對應的 LineItem
 * 使用條件更新確保冪等性：僅在 supplierId 為 null 時更新
 */
async function migrateRecord(
  record: PurchaseRecordData,
): Promise<"updated" | "skipped" | "error"> {
  try {
    // 先檢查是否已遷移，避免不必要的寫入
    const alreadyMigrated = await isAlreadyMigrated(record.orderItemId);
    if (alreadyMigrated) {
      return "skipped";
    }

    // 使用條件更新確保冪等性
    await ddb.send(
      new UpdateItemCommand({
        TableName: LINEITEM_TABLE_NAME,
        Key: marshall({ id: record.orderItemId }),
        UpdateExpression:
          "SET supplierId = :supplierId, supplierName = :supplierName, unitCost = :unitCost",
        ConditionExpression:
          "attribute_exists(id) AND (attribute_not_exists(supplierId) OR supplierId = :nullVal)",
        ExpressionAttributeValues: marshall({
          ":supplierId": record.supplierId,
          ":supplierName": record.supplierName,
          ":unitCost": record.unitCost,
          ":nullVal": null,
        }),
      }),
    );

    return "updated";
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };

    // ConditionalCheckFailedException 表示已遷移或 LineItem 不存在，視為跳過
    if (err.name === "ConditionalCheckFailedException") {
      return "skipped";
    }

    console.error(
      `  錯誤：遷移 PurchaseRecord ${record.id} (LineItem: ${record.orderItemId}) 失敗：${err.message ?? "未知錯誤"}`,
    );
    return "error";
  }
}

/**
 * 執行遷移
 */
async function migrate(): Promise<void> {
  console.log("=== 開始資料遷移：PurchaseRecord → LineItem ===");
  console.log(`PurchaseRecord 表：${PURCHASERECORD_TABLE_NAME}`);
  console.log(`LineItem 表：${LINEITEM_TABLE_NAME}`);
  console.log("");

  // Step 1: 掃描所有 PurchaseRecord
  console.log("步驟 1：掃描 PurchaseRecord 表...");
  const records = await scanAllPurchaseRecords();
  console.log(`  找到 ${records.length} 筆 PurchaseRecord`);
  console.log("");

  if (records.length === 0) {
    console.log("無需遷移的記錄，結束。");
    return;
  }

  // Step 2: 逐筆遷移
  console.log("步驟 2：回填採購數據至 LineItem...");
  const stats: MigrationStats = {
    totalScanned: records.length,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    const result = await migrateRecord(record);

    switch (result) {
      case "updated":
        stats.updated++;
        break;
      case "skipped":
        stats.skipped++;
        break;
      case "error":
        stats.errors++;
        break;
    }

    // 每 50 筆輸出進度
    if ((i + 1) % 50 === 0 || i === records.length - 1) {
      console.log(
        `  進度：${i + 1}/${records.length} (更新: ${stats.updated}, 跳過: ${stats.skipped}, 錯誤: ${stats.errors})`,
      );
    }
  }

  // Step 3: 輸出結果摘要
  console.log("");
  console.log("=== 遷移完成 ===");
  console.log(`  總掃描筆數：${stats.totalScanned}`);
  console.log(`  成功更新：${stats.updated}`);
  console.log(`  跳過（已遷移）：${stats.skipped}`);
  console.log(`  錯誤：${stats.errors}`);

  if (stats.errors > 0) {
    console.log("");
    console.log("⚠️  有部分記錄遷移失敗，請檢查上方錯誤訊息後重新執行腳本。");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 執行
// ---------------------------------------------------------------------------

migrate().catch((error: unknown) => {
  console.error("遷移腳本執行失敗：", error);
  process.exit(1);
});
