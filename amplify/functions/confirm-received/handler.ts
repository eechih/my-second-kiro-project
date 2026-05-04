import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidPurchaseStatusTransition } from "../../../shared/logic/purchase-record";
import { isValidLineItemStatusTransition } from "../../../shared/logic/line-item-status";
import type {
  LineItemStatus,
  PurchaseRecordStatus,
} from "../../../shared/models/order";

const ddb = new DynamoDBClient({});

/**
 * 入庫確認操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 增加 ProductVariant（或 Product）的 stockQuantity
 * - 更新 PurchaseRecord 狀態為 received 並記錄 receivedAt
 * - 更新 LineItem 狀態為「已收到」並記錄 receivedAt
 *
 * 包含驗證邏輯：
 * - PurchaseRecord 狀態必須為 pending（已入庫記錄不可重複確認）
 * - 庫存更新使用 ConditionExpression 檢查 version 值一致
 * - 庫存更新成功後自動遞增 version 欄位
 */
export const handler: Schema["confirmReceived"]["functionHandler"] = async (
  event,
) => {
  const { purchaseRecordId, purchaseRecordSortKey, lineItemId } =
    event.arguments;

  const purchaseRecordTable = process.env["PURCHASERECORD_TABLE_NAME"];
  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];
  const productVariantTable = process.env["PRODUCTVARIANT_TABLE_NAME"];

  if (
    !purchaseRecordTable ||
    !lineItemTable ||
    !productTable ||
    !productVariantTable
  ) {
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 PurchaseRecord 資料
    // PurchaseRecord 使用複合主鍵：lineItemId (PK) + purchasedAt (SK)
    const prResult = await ddb.send(
      new GetItemCommand({
        TableName: purchaseRecordTable,
        Key: marshall({
          lineItemId: purchaseRecordId,
          purchasedAt: purchaseRecordSortKey,
        }),
      }),
    );

    if (!prResult.Item) {
      return JSON.stringify({
        success: false,
        message: "找不到指定的採購記錄",
      });
    }

    const purchaseRecord = unmarshall(prResult.Item);

    // 2. 驗證採購記錄狀態——必須為 pending
    const prStatus = purchaseRecord["status"] as PurchaseRecordStatus;
    if (!isValidPurchaseStatusTransition(prStatus, "received")) {
      return JSON.stringify({
        success: false,
        message: `採購記錄目前狀態為「${prStatus}」，無法確認入庫`,
      });
    }

    const purchaseQuantity = purchaseRecord["quantity"] as number;

    // 3. 取得 LineItem 資料
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
    const lineItemStatus = lineItem["status"] as LineItemStatus;
    const variantId = (lineItem["variantId"] as string | null) ?? null;
    const productId = lineItem["productId"] as string;

    // 4. 取得庫存資訊（規格組合或商品層級）
    let stockVersion: number;
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
      const variant = unmarshall(variantResult.Item);
      stockVersion = variant["version"] as number;
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
      const product = unmarshall(productResult.Item);
      stockVersion = product["version"] as number;
      stockTableName = productTable;
      stockKey = { id: productId };
    }

    const now = new Date().toISOString();

    // 5. 建立交易項目
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 5a. 增加庫存（含版本檢查）
    transactItems.push({
      Update: {
        TableName: stockTableName,
        Key: marshall(stockKey),
        UpdateExpression:
          "SET stockQuantity = stockQuantity + :qty, #ver = #ver + :one, updatedAt = :now",
        ConditionExpression: "#ver = :expectedVersion",
        ExpressionAttributeNames: { "#ver": "version" },
        ExpressionAttributeValues: marshall({
          ":qty": purchaseQuantity,
          ":one": 1,
          ":expectedVersion": stockVersion,
          ":now": now,
        }),
      },
    });

    // 5b. 更新 PurchaseRecord 狀態為 received
    const existingPrHistory =
      (purchaseRecord["statusHistory"] as Record<string, unknown>[]) ?? [];
    const newPrHistoryEntry = {
      fromStatus: prStatus,
      toStatus: "received",
      changedAt: now,
    };
    const updatedPrHistory = [...existingPrHistory, newPrHistoryEntry];

    transactItems.push({
      Update: {
        TableName: purchaseRecordTable,
        Key: marshall({
          lineItemId: purchaseRecordId,
          purchasedAt: purchaseRecordSortKey,
        }),
        UpdateExpression:
          "SET #st = :newStatus, receivedAt = :now, statusHistory = :history, updatedAt = :now",
        ConditionExpression: "#st = :expectedStatus",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":newStatus": "received",
          ":expectedStatus": "pending",
          ":now": now,
          ":history": updatedPrHistory,
        }),
      },
    });

    // 5c. 更新 LineItem 狀態為「已收到」（若狀態轉換合法）
    const targetLineItemStatus: LineItemStatus = "已收到";
    const canTransition = isValidLineItemStatusTransition(
      lineItemStatus,
      targetLineItemStatus,
    );
    const finalLineItemStatus = canTransition
      ? targetLineItemStatus
      : lineItemStatus;

    if (canTransition) {
      transactItems.push({
        Update: {
          TableName: lineItemTable,
          Key: marshall({ id: lineItemId }),
          UpdateExpression:
            "SET #st = :newStatus, receivedAt = :now, updatedAt = :now",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":newStatus": targetLineItemStatus,
            ":now": now,
          }),
        },
      });
    }

    // 6. 執行交易
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    return JSON.stringify({
      success: true,
      message: "入庫確認成功",
      data: {
        purchaseRecordId,
        lineItemId,
        quantity: purchaseQuantity,
        lineItemStatus: finalLineItemStatus,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message:
          "入庫確認失敗：庫存版本衝突或採購記錄狀態已變更，請重新取得最新資料後重試",
      });
    }
    console.error("confirmReceived error:", error);
    return JSON.stringify({
      success: false,
      message: `入庫確認失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
