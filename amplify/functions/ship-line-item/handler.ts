import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidLineItemStatusTransition } from "../../../shared/logic/line-item-status";
import { isValidOrderStatusTransition } from "../../../shared/logic/order-status";
import { deriveOrderStatusFromLineItems } from "../../../shared/logic/order-status";
import {
  calculateRemainingShipQuantity,
  validateShipment,
} from "../../../shared/logic/shipment";
import type { LineItemStatus, OrderStatus } from "../../../shared/models/order";

const ddb = new DynamoDBClient({});

/**
 * 出貨操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 扣減 ProductVariant（或 Product）的 stockQuantity
 * - 更新 LineItem 的 shippedQuantity 與狀態為「已出貨」
 * - 條件性更新 Order 狀態（任一明細已出貨 → shipping，全部已出貨 → completed）
 *
 * 包含驗證邏輯：
 * - 明細狀態必須為「已收到」才可出貨
 * - 出貨數量不超過未出貨餘額
 * - 庫存數量充足（使用 ConditionExpression 檢查庫存充足且 version 值一致）
 * - 庫存更新成功後自動遞增 version 欄位
 */
export const handler: Schema["shipLineItem"]["functionHandler"] = async (
  event,
) => {
  const { orderId, orderSortKey, lineItemId, quantity } = event.arguments;

  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const orderTable = process.env["ORDER_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];
  const productVariantTable = process.env["PRODUCTVARIANT_TABLE_NAME"];

  if (!lineItemTable || !orderTable || !productTable || !productVariantTable) {
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

    // 2. 驗證明細狀態——僅「已收到」可出貨
    const currentStatus = lineItem["status"] as LineItemStatus;
    if (!isValidLineItemStatusTransition(currentStatus, "已出貨")) {
      return JSON.stringify({
        success: false,
        message: `明細項目目前狀態為「${currentStatus}」，無法執行出貨操作`,
      });
    }

    // 3. 驗證出貨數量
    const orderQuantity = lineItem["quantity"] as number;
    const shippedQuantity = lineItem["shippedQuantity"] as number;
    const remainingShipQty = calculateRemainingShipQuantity(
      orderQuantity,
      shippedQuantity,
    );

    // 4. 取得庫存資訊（規格組合或商品層級）
    const variantId = (lineItem["variantId"] as string | null) ?? null;
    const productId = lineItem["productId"] as string;
    let stockQuantity: number;
    let stockVersion: number;
    let stockTableName: string;
    let stockKey: Record<string, string>;

    if (variantId) {
      // 規格組合層級庫存
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
      stockQuantity = variant["stockQuantity"] as number;
      stockVersion = variant["version"] as number;
      stockTableName = productVariantTable;
      stockKey = { id: variantId };
    } else {
      // 商品層級庫存
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
      stockQuantity = product["stockQuantity"] as number;
      stockVersion = product["version"] as number;
      stockTableName = productTable;
      stockKey = { id: productId };
    }

    // 5. 使用共用驗證函式檢查出貨數量與庫存
    const shipmentValidation = validateShipment(
      quantity,
      remainingShipQty,
      stockQuantity,
    );
    if (!shipmentValidation.valid) {
      return JSON.stringify({
        success: false,
        message: shipmentValidation.error,
      });
    }

    // 6. 取得同一訂單的所有明細項目（用於推導訂單狀態）
    const allLineItemsResult = await ddb.send(
      new QueryCommand({
        TableName: lineItemTable,
        IndexName: "byOrderId",
        KeyConditionExpression: "orderId = :orderId",
        ExpressionAttributeValues: marshall({ ":orderId": orderId }),
      }),
    );

    const allLineItems = (allLineItemsResult.Items ?? []).map((rawItem) =>
      unmarshall(rawItem),
    );

    // 模擬出貨後的明細狀態列表（用於推導訂單狀態）
    const newShippedQty = shippedQuantity + quantity;
    const simulatedLineItems = allLineItems.map((li) => {
        if (li["id"] === lineItemId) {
          return {
            status:
              newShippedQty >= orderQuantity
                ? ("已出貨" as const)
                : (li["status"] as LineItemStatus),
          };
        }
        return { status: li["status"] as LineItemStatus };
    });

    const derivedOrderStatus = deriveOrderStatusFromLineItems(simulatedLineItems);

    // 7. 取得目前訂單資料（用於狀態轉換驗證）
    const orderResult = await ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ customerId: orderId, sortKey: orderSortKey }),
      }),
    );

    if (!orderResult.Item) {
      return JSON.stringify({ success: false, message: "找不到指定的訂單" });
    }

    const order = unmarshall(orderResult.Item);
    const currentOrderStatus = order["status"] as OrderStatus;
    const now = new Date().toISOString();

    // 8. 建立交易項目
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 8a. 扣減庫存（含版本檢查）
    transactItems.push({
      Update: {
        TableName: stockTableName,
        Key: marshall(stockKey),
        UpdateExpression:
          "SET stockQuantity = stockQuantity - :qty, #ver = #ver + :one, updatedAt = :now",
        ConditionExpression:
          "#ver = :expectedVersion AND stockQuantity >= :qty",
        ExpressionAttributeNames: { "#ver": "version" },
        ExpressionAttributeValues: marshall({
          ":qty": quantity,
          ":one": 1,
          ":expectedVersion": stockVersion,
          ":now": now,
        }),
      },
    });

    // 8b. 更新 LineItem
    const lineItemUpdateStatus: LineItemStatus =
      newShippedQty >= orderQuantity ? "已出貨" : currentStatus;
    transactItems.push({
      Update: {
        TableName: lineItemTable,
        Key: marshall({ id: lineItemId }),
        UpdateExpression:
          "SET shippedQuantity = :newShippedQty, #st = :newStatus, shippedAt = :now, updatedAt = :now",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":newShippedQty": newShippedQty,
          ":newStatus": lineItemUpdateStatus,
          ":now": now,
        }),
      },
    });

    // 8c. 條件性更新 Order 狀態
    if (derivedOrderStatus && derivedOrderStatus !== currentOrderStatus) {
      if (
        isValidOrderStatusTransition(currentOrderStatus, derivedOrderStatus)
      ) {
        const existingHistory =
          (order["statusHistory"] as Record<string, unknown>[]) ?? [];
        const newHistoryEntry = {
          fromStatus: currentOrderStatus,
          toStatus: derivedOrderStatus,
          changedAt: now,
        };
        const updatedHistory = [...existingHistory, newHistoryEntry];

        transactItems.push({
          Update: {
            TableName: orderTable,
            Key: marshall({ customerId: orderId, sortKey: orderSortKey }),
            UpdateExpression:
              "SET #st = :newStatus, statusHistory = :history, updatedAt = :now",
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: marshall({
              ":newStatus": derivedOrderStatus,
              ":history": updatedHistory,
              ":now": now,
            }),
          },
        });
      }
    }

    // 9. 執行交易
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    return JSON.stringify({
      success: true,
      message: "出貨操作成功",
      data: {
        lineItemId,
        shippedQuantity: newShippedQty,
        lineItemStatus: lineItemUpdateStatus,
        orderStatus: derivedOrderStatus ?? currentOrderStatus,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message:
          "出貨操作失敗：庫存版本衝突或庫存不足，請重新取得最新資料後重試",
      });
    }
    console.error("shipLineItem error:", error);
    return JSON.stringify({
      success: false,
      message: `出貨操作失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
