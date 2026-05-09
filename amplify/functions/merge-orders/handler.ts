import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { validateMergeOrders } from "@shared/logic/order-merge";
import {
  normalizeLineItemStatus,
  normalizeOrderStatus,
  type LineItem,
  type Order,
} from "@shared/models/order";

const ddb = new DynamoDBClient({});

type DdbRecord = Record<string, unknown>;

/** 產生唯一訂單編號（時間戳 + 隨機碼） */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

function parseOrderIds(raw: unknown): string[] {
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("訂單 ID 格式不正確");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("訂單 ID 格式不正確");
  }

  return parsed.map((orderId) => {
    if (typeof orderId !== "string" || !orderId.trim()) {
      throw new Error("訂單 ID 格式不正確");
    }
    return orderId.trim();
  });
}

function mapLineItem(raw: DdbRecord): LineItem {
  return {
    id: String(raw["id"] ?? ""),
    productId: String(raw["productId"] ?? ""),
    productName: String(raw["productName"] ?? ""),
    variantId: raw["variantId"] ? String(raw["variantId"]) : null,
    variantLabel: raw["variantLabel"] ? String(raw["variantLabel"]) : null,
    quantity: Number(raw["quantity"] ?? 0),
    unitPrice: Number(raw["unitPrice"] ?? 0),
    subtotal: Number(raw["subtotal"] ?? 0),
    status: normalizeLineItemStatus(raw["status"]),
    purchasedQuantity: Number(raw["purchasedQuantity"] ?? 0),
    shippedQuantity: Number(raw["shippedQuantity"] ?? 0),
    purchasedAt: raw["purchasedAt"] ? String(raw["purchasedAt"]) : null,
    receivedAt: raw["receivedAt"] ? String(raw["receivedAt"]) : null,
    shippedAt: raw["shippedAt"] ? String(raw["shippedAt"]) : null,
    supplierId: raw["supplierId"] ? String(raw["supplierId"]) : null,
    supplierName: raw["supplierName"] ? String(raw["supplierName"]) : null,
    unitCost:
      raw["unitCost"] !== null && raw["unitCost"] !== undefined
        ? Number(raw["unitCost"])
        : null,
  };
}

function mapOrder(raw: DdbRecord, lineItems: LineItem[]): Order {
  return {
    id: String(raw["id"] ?? ""),
    orderNumber: String(raw["orderNumber"] ?? ""),
    customerId: String(raw["customerId"] ?? ""),
    customerName: String(raw["customerName"] ?? ""),
    lineItems,
    totalAmount: Number(raw["totalAmount"] ?? 0),
    status: normalizeOrderStatus(raw["status"]),
    statusHistory: Array.isArray(raw["statusHistory"])
      ? (raw["statusHistory"] as Order["statusHistory"])
      : [],
    createdAt: String(raw["createdAt"] ?? ""),
    updatedAt: String(raw["updatedAt"] ?? ""),
  };
}

/**
 * 訂單合併操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 建立新 Order（包含所有來源訂單的 LineItems）
 * - 搬移所有 LineItems 的 orderId 至新 Order
 * - 將所有來源 Orders 狀態變更為 cancelled
 *
 * 包含驗證邏輯：
 * - 所有來源訂單屬於同一客戶
 * - 狀態皆為 pending 或 confirmed
 * - 合併後新訂單總金額等於所有來源明細小計加總
 */
export const handler: Schema["mergeOrders"]["functionHandler"] = async (
  event,
) => {
  const orderTable = process.env["ORDER_TABLE_NAME"];
  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];

  if (!orderTable || !lineItemTable) {
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    const orderIds = parseOrderIds(event.arguments.orderIds);

    // 1. 驗證至少兩筆訂單
    if (orderIds.length < 2) {
      return JSON.stringify({
        success: false,
        message: "至少需要選取兩筆訂單才能合併",
      });
    }

    const uniqueOrderIds = new Set(orderIds);
    if (uniqueOrderIds.size !== orderIds.length) {
      return JSON.stringify({
        success: false,
        message: "不可重複選取同一筆訂單",
      });
    }

    // 2. 取得所有來源訂單與明細資料
    const orderRecords: DdbRecord[] = [];
    const lineItemsByOrderId = new Map<string, DdbRecord[]>();
    for (const oid of orderIds) {
      const result = await ddb.send(
        new GetItemCommand({
          TableName: orderTable,
          Key: marshall({ id: oid }),
        }),
      );
      if (!result.Item) {
        return JSON.stringify({
          success: false,
          message: `找不到訂單：${oid}`,
        });
      }

      const orderRecord = unmarshall(result.Item);
      orderRecords.push(orderRecord);

      const lineItemsResult = await ddb.send(
        new QueryCommand({
          TableName: lineItemTable,
          IndexName: "byOrderId",
          KeyConditionExpression: "orderId = :orderId",
          ExpressionAttributeValues: marshall({ ":orderId": oid }),
        }),
      );

      const items = (lineItemsResult.Items ?? []).map((rawItem) =>
        unmarshall(rawItem),
      );
      lineItemsByOrderId.set(oid, items);
    }

    const orders = orderRecords.map((orderRecord) =>
      mapOrder(
        orderRecord,
        (lineItemsByOrderId.get(String(orderRecord["id"] ?? "")) ?? []).map(
          mapLineItem,
        ),
      ),
    );

    const validation = validateMergeOrders(orders);
    if (!validation.valid) {
      return JSON.stringify({
        success: false,
        message: validation.error,
      });
    }

    const allLineItems = [...lineItemsByOrderId.values()].flat();
    const totalAmount = allLineItems.reduce(
      (sum, lineItem) => sum + Number(lineItem["subtotal"] ?? 0),
      0,
    );
    const now = new Date().toISOString();
    const newOrderNumber = generateOrderNumber();
    const newOrderId = crypto.randomUUID();
    const firstOrder = orders[0]!;

    // 3. 建立交易項目（DynamoDB TransactWriteItems 最多 100 個項目）
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 3a. 建立新訂單
    transactItems.push({
      Put: {
        TableName: orderTable,
        Item: marshall({
          id: newOrderId,
          customerId: firstOrder.customerId,
          orderNumber: newOrderNumber,
          customerName: firstOrder.customerName,
          totalAmount,
          status: "pending",
          gsiPartition: "Order",
          createdAtForSort: now,
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
        ConditionExpression: "attribute_not_exists(id)",
      },
    });

    // 3b. 搬移所有 LineItems 的 orderId 至新 Order
    for (const lineItem of allLineItems) {
      transactItems.push({
        Update: {
          TableName: lineItemTable,
          Key: marshall({ id: lineItem["id"] as string }),
          UpdateExpression: "SET orderId = :newOrderId, updatedAt = :now",
          ConditionExpression: "orderId = :sourceOrderId",
          ExpressionAttributeValues: marshall({
            ":newOrderId": newOrderId,
            ":sourceOrderId": lineItem["orderId"] as string,
            ":now": now,
          }),
        },
      });
    }

    // 3c. 將所有來源 Orders 狀態變更為 cancelled
    for (const order of orderRecords) {
      const currentStatus = normalizeOrderStatus(order["status"]);
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
          Key: marshall({ id: order["id"] as string }),
          UpdateExpression:
            "SET #st = :cancelled, statusHistory = :history, updatedAt = :now",
          ConditionExpression: "#st = :currentStatus",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":cancelled": "cancelled",
            ":currentStatus": currentStatus,
            ":history": updatedHistory,
            ":now": now,
          }),
        },
      });
    }

    // 4. 檢查交易項目數量限制（DynamoDB 最多 100 個）
    if (transactItems.length > 100) {
      return JSON.stringify({
        success: false,
        message: `合併操作涉及 ${String(transactItems.length)} 個項目，超過 DynamoDB 交易限制（100）。請減少合併的訂單數量。`,
      });
    }

    // 5. 執行交易
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    return JSON.stringify({
      success: true,
      message: "訂單合併成功",
      data: {
        id: newOrderId,
        customerId: firstOrder.customerId,
        newOrderNumber,
        orderNumber: newOrderNumber,
        customerName: firstOrder.customerName,
        status: "pending",
        statusHistory: [
          {
            fromStatus: "created",
            toStatus: "pending",
            changedAt: now,
          },
        ],
        lineItems: [],
        createdAt: now,
        updatedAt: now,
        totalAmount,
        mergedOrderCount: orders.length,
        lineItemCount: allLineItems.length,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.message === "訂單 ID 格式不正確") {
      return JSON.stringify({
        success: false,
        message: err.message,
      });
    }
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message:
          "訂單合併失敗：訂單狀態已變更，請重新取得最新資料後重試",
      });
    }
    console.error("mergeOrders error:", error);
    return JSON.stringify({
      success: false,
      message: `訂單合併失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
