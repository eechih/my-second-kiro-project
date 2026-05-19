import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { validateProcurementReceive } from "@shared/logic/procurement";
import { normalizeOrderItemStatus } from "@shared/models/order";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmReceived";

/**
 * 入庫確認操作 Lambda 函式（簡化版）
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 更新 OrderItem 狀態為「已收到」並記錄 receivedAt
 * - 增加 Product 的 stockQuantity（庫存統一在商品層級管理）
 *
 * 不再查詢 PurchaseRecord 表，直接從 OrderItem 讀取 status 判斷是否可入庫。
 *
 * 包含驗證邏輯：
 * - OrderItem status 必須為「已訂購」（使用 validateProcurementReceive 共用驗證）
 * - 庫存更新使用 DynamoDB 原子操作，避免前端維護版本欄位
 *
 * 需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export const handler: Schema["confirmReceived"]["functionHandler"] = async (
  event,
) => {
  const { lineItemId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { lineItemId });

  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];

  if (!lineItemTable || !productTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasLineItemTable: !!lineItemTable,
      hasProductTable: !!productTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 OrderItem 資料
    const lineItemResult = await ddb.send(
      new GetItemCommand({
        TableName: lineItemTable,
        Key: marshall({ id: lineItemId }),
      }),
    );

    if (!lineItemResult.Item) {
      logWarn(FUNCTION_NAME, "line item not found", { lineItemId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的明細項目",
      });
    }

    const lineItem = unmarshall(lineItemResult.Item);
    const status = normalizeOrderItemStatus(lineItem["status"]);
    const quantity = lineItem["quantity"] as number;
    const productId = lineItem["productId"] as string;
    logDebug(FUNCTION_NAME, "line item loaded", {
      lineItemId,
      productId,
      status,
      quantity,
      rawStatus: lineItem["status"],
    });

    // 2. 使用共用驗證函式檢查前置條件
    const validation = validateProcurementReceive({ status });
    if (!validation.valid) {
      logWarn(FUNCTION_NAME, "validation failed", {
        lineItemId,
        productId,
        status,
        validationError: validation.error,
      });
      return JSON.stringify({
        success: false,
        message: validation.error,
      });
    }

    // 3. 取得庫存資訊（統一在商品層級管理）
    const productResult = await ddb.send(
      new GetItemCommand({
        TableName: productTable,
        Key: marshall({ id: productId }),
      }),
    );
    if (!productResult.Item) {
      logWarn(FUNCTION_NAME, "product not found", { lineItemId, productId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的商品",
      });
    }
    const product = unmarshall(productResult.Item);
    logDebug(FUNCTION_NAME, "product loaded", {
      lineItemId,
      productId,
      stockQuantity: product["stockQuantity"],
    });

    const now = new Date().toISOString();

    // 4. 建立交易項目（僅 2 個操作：OrderItem 更新 + 庫存更新）
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 4a. 更新 OrderItem：status → "received"、receivedAt
    transactItems.push({
      Update: {
        TableName: lineItemTable,
        Key: marshall({ id: lineItemId }),
        UpdateExpression:
          "SET #st = :newStatus, receivedAt = :now, updatedAt = :now",
        ConditionExpression:
          "#st = :expectedStatus OR #st = :legacyExpectedStatus",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":newStatus": "received",
          ":expectedStatus": "ordered",
          ":legacyExpectedStatus": "已訂購",
          ":now": now,
        }),
      },
    });

    // 4b. 增加庫存（商品層級）
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

    // 5. 執行交易
    logDebug(FUNCTION_NAME, "executing transaction", {
      lineItemId,
      productId,
      quantity,
      transactItemCount: transactItems.length,
    });
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      lineItemId,
      productId,
      quantity,
      lineItemStatus: "received",
    });
    return JSON.stringify({
      success: true,
      message: "入庫確認成功",
      data: {
        lineItemId,
        quantity,
        lineItemStatus: "received",
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        lineItemId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "入庫確認失敗，請重新取得最新資料後重試",
      });
    }
    logError(FUNCTION_NAME, "handler failed", error, { lineItemId });
    return JSON.stringify({
      success: false,
      message: `入庫確認失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
