import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { validateProcurementReceive } from "../../../shared/logic/procurement";
import { normalizeLineItemStatus } from "../../../shared/models/order";

const ddb = new DynamoDBClient({});

/**
 * 入庫確認操作 Lambda 函式（簡化版）
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 更新 LineItem 狀態為「已收到」並記錄 receivedAt
 * - 增加 ProductVariant（或 Product）的 stockQuantity
 *
 * 不再查詢 PurchaseRecord 表，直接從 LineItem 讀取 status 與 purchasedQuantity。
 *
 * 包含驗證邏輯：
 * - LineItem status 必須為「已訂購」（使用 validateProcurementReceive 共用驗證）
 * - 庫存更新使用 DynamoDB 原子操作，避免前端維護版本欄位
 *
 * 需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export const handler: Schema["confirmReceived"]["functionHandler"] = async (
  event,
) => {
  const { lineItemId } = event.arguments;

  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];
  const productVariantTable = process.env["PRODUCTVARIANT_TABLE_NAME"];

  if (!lineItemTable || !productTable || !productVariantTable) {
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 LineItem 資料
    const lineItemResult = await ddb.send(
      new GetItemCommand({
        TableName: lineItemTable,
        Key: marshall({ id: lineItemId }),
      }),
    );

    if (!lineItemResult.Item) {
      return JSON.stringify({
        success: false,
        message: "找不到指定的明細項目",
      });
    }

    const lineItem = unmarshall(lineItemResult.Item);
    const status = normalizeLineItemStatus(lineItem["status"]);
    const purchasedQuantity = lineItem["purchasedQuantity"] as number;

    // 2. 使用共用驗證函式檢查前置條件
    const validation = validateProcurementReceive({ status, purchasedQuantity });
    if (!validation.valid) {
      return JSON.stringify({
        success: false,
        message: validation.error,
      });
    }

    // 3. 取得庫存資訊（規格組合或商品層級）
    const variantId = (lineItem["variantId"] as string | null) ?? null;
    const productId = lineItem["productId"] as string;
    let stockTableName: string;
    let stockKey: Record<string, string>;

    if (variantId) {
      const variantResult = await ddb.send(
        new GetItemCommand({
          TableName: productVariantTable,
          Key: marshall({ id: variantId }),
        }),
      );
      if (!variantResult.Item) {
        return JSON.stringify({
          success: false,
          message: "找不到指定的規格組合",
        });
      }
      stockTableName = productVariantTable;
      stockKey = { id: variantId };
    } else {
      const productResult = await ddb.send(
        new GetItemCommand({
          TableName: productTable,
          Key: marshall({ id: productId }),
        }),
      );
      if (!productResult.Item) {
        return JSON.stringify({
          success: false,
          message: "找不到指定的商品",
        });
      }
      stockTableName = productTable;
      stockKey = { id: productId };
    }

    const now = new Date().toISOString();

    // 4. 建立交易項目（僅 2 個操作：LineItem 更新 + 庫存更新）
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 4a. 更新 LineItem：status → "received"、receivedAt
    transactItems.push({
      Update: {
        TableName: lineItemTable,
        Key: marshall({ id: lineItemId }),
        UpdateExpression:
          "SET #st = :newStatus, receivedAt = :now, updatedAt = :now",
        ConditionExpression: "#st = :expectedStatus OR #st = :legacyExpectedStatus",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":newStatus": "received",
          ":expectedStatus": "ordered",
          ":legacyExpectedStatus": "已訂購",
          ":now": now,
        }),
      },
    });

    // 4b. 增加庫存
    transactItems.push({
      Update: {
        TableName: stockTableName,
        Key: marshall(stockKey),
        UpdateExpression:
          "SET stockQuantity = stockQuantity + :qty, updatedAt = :now",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeValues: marshall({
          ":qty": purchasedQuantity,
          ":now": now,
        }),
      },
    });

    // 5. 執行交易
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    return JSON.stringify({
      success: true,
      message: "入庫確認成功",
      data: {
        lineItemId,
        quantity: purchasedQuantity,
        lineItemStatus: "received",
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message: "入庫確認失敗，請重新取得最新資料後重試",
      });
    }
    console.error("confirmReceived error:", error);
    return JSON.stringify({
      success: false,
      message: `入庫確認失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
