import type { Schema } from "../../data/resource";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { logError, logInfo, logWarn } from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "createProduct";
const COUNTER_NAME = "ProductSku";
const SKU_PREFIX = "SKU";
const SKU_PADDING = 6;

interface MutationResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

function fail(message: string): string {
  return JSON.stringify({ success: false, message } satisfies MutationResult);
}

function succeed(message: string, data: Record<string, unknown>): string {
  return JSON.stringify({
    success: true,
    message,
    data,
  } satisfies MutationResult);
}

function formatSku(sequence: number): string {
  return `${SKU_PREFIX}-${String(sequence).padStart(SKU_PADDING, "0")}`;
}

function parseSkuSequence(sku: unknown): number {
  if (typeof sku !== "string") return 0;
  const match = new RegExp(`^${SKU_PREFIX}-(\\d+)$`).exec(sku.trim());
  return match ? Number(match[1]) : 0;
}

async function findMaxExistingSkuSequence(
  productTable: string,
): Promise<number> {
  let maxSequence = 0;
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: productTable,
        ProjectionExpression: "sku",
        ExclusiveStartKey: exclusiveStartKey
          ? marshall(exclusiveStartKey)
          : undefined,
      }),
    );

    for (const item of result.Items ?? []) {
      maxSequence = Math.max(
        maxSequence,
        parseSkuSequence(unmarshall(item).sku),
      );
    }

    exclusiveStartKey = result.LastEvaluatedKey
      ? unmarshall(result.LastEvaluatedKey)
      : undefined;
  } while (exclusiveStartKey);

  return maxSequence;
}

async function ensureCounterInitialized(
  counterTable: string,
  productTable: string,
  now: string,
): Promise<void> {
  const maxSequence = await findMaxExistingSkuSequence(productTable);

  try {
    await ddb.send(
      new PutItemCommand({
        TableName: counterTable,
        Item: marshall({
          id: COUNTER_NAME,
          name: COUNTER_NAME,
          current: maxSequence,
          createdAt: now,
          updatedAt: now,
        }),
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return;
    }
    throw error;
  }
}

async function allocateSkuSequence(
  counterTable: string,
  productTable: string,
  now: string,
): Promise<number> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await ddb.send(
        new UpdateItemCommand({
          TableName: counterTable,
          Key: marshall({ id: COUNTER_NAME }),
          UpdateExpression:
            "SET #current = #current + :one, updatedAt = :now",
          ConditionExpression: "attribute_exists(id)",
          ExpressionAttributeNames: {
            "#current": "current",
          },
          ExpressionAttributeValues: marshall({
            ":one": 1,
            ":now": now,
          }),
          ReturnValues: "UPDATED_NEW",
        }),
      );

      return Number(
        result.Attributes ? unmarshall(result.Attributes).current : 0,
      );
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }

      await ensureCounterInitialized(counterTable, productTable, now);
    }
  }

  throw new Error("無法產生 SKU 流水號");
}

export const handler: Schema["createProductWithAutoSku"]["functionHandler"] =
  async (event) => {
    const productTable = process.env["PRODUCT_TABLE_NAME"];
    const counterTable = process.env["SEQUENCECOUNTER_TABLE_NAME"];
    const {
      name,
      description,
      price,
      cost,
      defaultSupplierId,
      stockQuantity,
      imageUrls,
    } = event.arguments;

    logInfo(FUNCTION_NAME, "handler started", { name });

    if (!productTable || !counterTable) {
      logWarn(FUNCTION_NAME, "missing environment variables", {
        hasProductTable: !!productTable,
        hasCounterTable: !!counterTable,
      });
      return fail("缺少必要的環境變數設定");
    }

    try {
      const now = new Date().toISOString();
      const trimmedName = name.trim();

      if (!trimmedName) {
        return fail("商品名稱為必填");
      }
      if (price < 0 || cost < 0 || (stockQuantity ?? 0) < 0) {
        return fail("單價、進貨成本與庫存數量不可為負數");
      }

      const sequence = await allocateSkuSequence(counterTable, productTable, now);
      const sku = formatSku(sequence);
      const id = uuidv4();
      const product = {
        id,
        name: trimmedName,
        sku,
        description: description ?? "",
        price,
        cost,
        defaultSupplierId: defaultSupplierId ?? null,
        stockQuantity: stockQuantity ?? 0,
        imageUrls: imageUrls ?? [],
        isActive: true,
        activeStatusKey: "ACTIVE",
        gsiPartition: "Product",
        createdAtForSort: now,
        createdAt: now,
        updatedAt: now,
      };

      await ddb.send(
        new PutItemCommand({
          TableName: productTable,
          Item: marshall(product),
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );

      logInfo(FUNCTION_NAME, "handler succeeded", { id, sku });
      return succeed("商品建立成功", product);
    } catch (error: unknown) {
      const err = error as { message?: string };
      logError(FUNCTION_NAME, "handler failed", error, { name });
      return fail(`建立商品失敗：${err.message ?? "未知錯誤"}`);
    }
  };
