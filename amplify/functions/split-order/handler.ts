import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidOrderStatusTransition } from "../../../shared/logic/order-status";
import type { OrderStatus } from "../../../shared/models/order";

const ddb = new DynamoDBClient({});

/** 分配方式（前端傳入的 JSON 結構） */
interface SplitAllocationInput {
  lineItemId: string;
  targetOrderIndex: number;
}

/** 產生唯一訂單編號（時間戳 + 隨機碼） */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

/**
 * 訂單分拆操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 建立多筆新 Orders
 * - 依分配方式將 LineItems 的 orderId 更新至對應的新 Order
 * - 將原 Order 狀態變更為 cancelled
 *
 * 包含驗證邏輯：
 * - 原訂單狀態為 pending 或 confirmed
 * - 所有 LineItems 皆有分配目標
 * - 分拆後所有新訂單的明細項目總和等於原訂單（數量守恆）
 */
export const handler: Schema["splitOrder"]["functionHandler"] = async (
  event,
) => {
  const { orderId, orderSortKey, allocations: allocationsRaw } =
    event.arguments;

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];

  if (!orderTable || !lineItemTable) {
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    const allocations = allocationsRaw as unknown as SplitAllocationInput[];

    // 1. 取得原訂單資料
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
    const currentStatus = order["status"] as OrderStatus;

    // 2. 驗證訂單狀態——僅 pending 或 confirmed 可分拆
    const splittableStatuses = new Set<string>(["pending", "confirmed"]);
    if (!splittableStatuses.has(currentStatus)) {
      return JSON.stringify({
        success: false,
        message: "僅能分拆待處理或已確認的訂單",
      });
    }

    // 3. 驗證分配列表
    if (!Array.isArray(allocations) || allocations.length === 0) {
      return JSON.stringify({
        success: false,
        message: "分配列表不可為空",
      });
    }

    // 4. 取得原訂單的所有明細項目
    const lineItemsResult = await ddb.send(
      new QueryCommand({
        TableName: lineItemTable,
        IndexName: "byOrderId",
        KeyConditionExpression: "orderId = :orderId",
        ExpressionAttributeValues: marshall({ ":orderId": orderId }),
      }),
    );

    const allLineItems = (lineItemsResult.Items ?? [])
      .map((rawItem) => unmarshall(rawItem))
      .filter(
        (item) =>
          item["orderSortKey"] === orderSortKey,
      );

    const lineItemMap = new Map<string, Record<string, unknown>>();
    for (const li of allLineItems) {
      lineItemMap.set(li["id"] as string, li);
    }

    // 5. 驗證所有明細項目皆有分配目標
    const allocatedIds = new Set(allocations.map((a) => a.lineItemId));
    const orderLineItemIds = new Set(
      allLineItems.map((li) => li["id"] as string),
    );

    // 檢查分配列表中的明細 ID 是否存在於原訂單
    for (const allocation of allocations) {
      if (!orderLineItemIds.has(allocation.lineItemId)) {
        return JSON.stringify({
          success: false,
          message: `明細項目 ${allocation.lineItemId} 不存在於此訂單中`,
        });
      }
    }

    // 檢查所有明細項目皆有分配目標
    for (const lineItemId of orderLineItemIds) {
      if (!allocatedIds.has(lineItemId)) {
        return JSON.stringify({
          success: false,
          message: "所有明細項目皆必須有分配目標",
        });
      }
    }

    // 6. 驗證至少分配到兩筆不同的新訂單
    const targetIndices = new Set(allocations.map((a) => a.targetOrderIndex));
    if (targetIndices.size < 2) {
      return JSON.stringify({
        success: false,
        message: "至少需要分配到兩筆不同的新訂單",
      });
    }

    // 7. 依 targetOrderIndex 分組明細項目
    const groupedLineItems = new Map<number, Record<string, unknown>[]>();
    for (const allocation of allocations) {
      const lineItem = lineItemMap.get(allocation.lineItemId);
      if (!lineItem) continue;

      const group = groupedLineItems.get(allocation.targetOrderIndex);
      if (group) {
        group.push(lineItem);
      } else {
        groupedLineItems.set(allocation.targetOrderIndex, [lineItem]);
      }
    }

    const now = new Date().toISOString();
    const customerId = order["customerId"] as string;
    const customerName = order["customerName"] as string;

    // 8. 建立交易項目
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];
    const newOrders: {
      orderNumber: string;
      sortKey: string;
      totalAmount: number;
      lineItemCount: number;
    }[] = [];

    // 8a. 為每個分組建立新訂單
    const sortedIndices = [...groupedLineItems.keys()].sort((a, b) => a - b);
    for (const index of sortedIndices) {
      const lineItems = groupedLineItems.get(index)!;
      const newOrderNumber = generateOrderNumber();
      const newSortKey = `ORDER#${now}-${String(index)}`;

      // 計算新訂單總金額
      let totalAmount = 0;
      for (const li of lineItems) {
        totalAmount +=
          (li["quantity"] as number) * (li["unitPrice"] as number);
      }

      // 建立新訂單
      transactItems.push({
        Put: {
          TableName: orderTable,
          Item: marshall({
            customerId,
            sortKey: newSortKey,
            orderNumber: newOrderNumber,
            customerName,
            totalAmount,
            status: "pending",
            statusHistory: [
              {
                fromStatus: "created",
                toStatus: "pending",
                changedAt: now,
              },
            ],
            createdAt: now,
            updatedAt: now,
          }),
        },
      });

      newOrders.push({
        orderNumber: newOrderNumber,
        sortKey: newSortKey,
        totalAmount,
        lineItemCount: lineItems.length,
      });

      // 搬移明細項目至新訂單
      for (const li of lineItems) {
        transactItems.push({
          Update: {
            TableName: lineItemTable,
            Key: marshall({ id: li["id"] as string }),
            UpdateExpression:
              "SET orderId = :newOrderId, orderSortKey = :newSortKey, updatedAt = :now",
            ExpressionAttributeValues: marshall({
              ":newOrderId": customerId,
              ":newSortKey": newSortKey,
              ":now": now,
            }),
          },
        });
      }
    }

    // 8b. 將原訂單狀態變更為 cancelled
    if (isValidOrderStatusTransition(currentStatus, "cancelled")) {
      const existingHistory =
        (order["statusHistory"] as Record<string, unknown>[]) ?? [];
      const newHistoryEntry = {
        fromStatus: currentStatus,
        toStatus: "cancelled",
        changedAt: now,
      };
      const updatedHistory = [...existingHistory, newHistoryEntry];

      transactItems.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ customerId: orderId, sortKey: orderSortKey }),
          UpdateExpression:
            "SET #st = :cancelled, statusHistory = :history, updatedAt = :now",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":cancelled": "cancelled",
            ":history": updatedHistory,
            ":now": now,
          }),
        },
      });
    }

    // 9. 檢查交易項目數量限制
    if (transactItems.length > 100) {
      return JSON.stringify({
        success: false,
        message: `分拆操作涉及 ${String(transactItems.length)} 個項目，超過 DynamoDB 交易限制（100）。請減少分拆的明細項目數量。`,
      });
    }

    // 10. 執行交易
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    return JSON.stringify({
      success: true,
      message: "訂單分拆成功",
      data: {
        originalOrderId: orderId,
        originalOrderSortKey: orderSortKey,
        newOrders,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message:
          "訂單分拆失敗：訂單狀態已變更，請重新取得最新資料後重試",
      });
    }
    console.error("splitOrder error:", error);
    return JSON.stringify({
      success: false,
      message: `訂單分拆失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
