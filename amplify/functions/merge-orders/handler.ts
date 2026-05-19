import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
  QueryCommand,
  type TransactWriteItem,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { validateMergeOrders } from "@shared/logic/order-merge";
import {
  normalizeLineItemStatus,
  normalizeOrderStatus,
  type OrderItem,
  type Order,
} from "@shared/models/order";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "mergeOrders";
const DYNAMO_TRANSACTION_LIMIT = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DdbRecord = Record<string, unknown>;

interface MergeResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function fail(message: string): string {
  return JSON.stringify({ success: false, message } satisfies MergeResult);
}

function succeed(message: string, data: Record<string, unknown>): string {
  return JSON.stringify({ success: true, message, data } satisfies MergeResult);
}

// ---------------------------------------------------------------------------
// DynamoDB record mappers
// ---------------------------------------------------------------------------

function mapLineItem(raw: DdbRecord): OrderItem {
  return {
    id: String(raw["id"] ?? ""),
    productId: String(raw["productId"] ?? ""),
    productName: String(raw["productName"] ?? ""),
    variantLabel: raw["variantLabel"] ? String(raw["variantLabel"]) : null,
    quantity: Number(raw["quantity"] ?? 0),
    unitPrice: Number(raw["unitPrice"] ?? 0),
    subtotal: Number(raw["subtotal"] ?? 0),
    status: normalizeLineItemStatus(raw["status"]),
    purchasedAt: raw["purchasedAt"] ? String(raw["purchasedAt"]) : null,
    receivedAt: raw["receivedAt"] ? String(raw["receivedAt"]) : null,
    shippedAt: raw["shippedAt"] ? String(raw["shippedAt"]) : null,
    outOfStockAt: raw["outOfStockAt"] ? String(raw["outOfStockAt"]) : null,
    supplierName: raw["supplierName"] ? String(raw["supplierName"]) : null,
    unitCost:
      raw["unitCost"] !== null && raw["unitCost"] !== undefined
        ? Number(raw["unitCost"])
        : null,
  };
}

function mapOrder(raw: DdbRecord, lineItems: OrderItem[]): Order {
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

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface FetchedOrderData {
  record: DdbRecord;
  lineItems: DdbRecord[];
}

async function fetchOrderWithLineItems(
  orderId: string,
  orderTable: string,
  lineItemTable: string,
): Promise<FetchedOrderData | null> {
  const [orderResult, lineItemsResult] = await Promise.all([
    ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
      }),
    ),
    ddb.send(
      new QueryCommand({
        TableName: lineItemTable,
        IndexName: "byOrderId",
        KeyConditionExpression: "orderId = :orderId",
        ExpressionAttributeValues: marshall({ ":orderId": orderId }),
      }),
    ),
  ]);

  if (!orderResult.Item) {
    return null;
  }

  return {
    record: unmarshall(orderResult.Item),
    lineItems: (lineItemsResult.Items ?? []).map((item) => unmarshall(item)),
  };
}

// ---------------------------------------------------------------------------
// Transaction item builders
// ---------------------------------------------------------------------------

/** 產生唯一訂單編號（時間戳 + 隨機碼） */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

function buildNewOrderItem(
  orderTable: string,
  newOrderId: string,
  order: Order,
  totalAmount: number,
  now: string,
): TransactWriteItem {
  const newOrderNumber = generateOrderNumber();
  return {
    Put: {
      TableName: orderTable,
      Item: marshall({
        id: newOrderId,
        customerId: order.customerId,
        orderNumber: newOrderNumber,
        customerName: order.customerName,
        totalAmount,
        status: "pending",
        gsiPartition: "Order",
        createdAtForSort: now,
        statusHistory: [
          { fromStatus: "created", toStatus: "pending", changedAt: now },
        ],
        createdAt: now,
        updatedAt: now,
      }),
      ConditionExpression: "attribute_not_exists(id)",
    },
  };
}

function buildLineItemMoveItems(
  lineItemTable: string,
  lineItems: DdbRecord[],
  newOrderId: string,
  now: string,
): TransactWriteItem[] {
  return lineItems.map((lineItem) => ({
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
  }));
}

function buildCancelOrderItems(
  orderTable: string,
  orderRecords: DdbRecord[],
  now: string,
): TransactWriteItem[] {
  return orderRecords.map((order) => {
    const currentStatus = normalizeOrderStatus(order["status"]);
    const existingHistory =
      (order["statusHistory"] as Record<string, unknown>[]) ?? [];
    const updatedHistory = [
      ...existingHistory,
      { fromStatus: currentStatus, toStatus: "cancelled", changedAt: now },
    ];

    return {
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
    };
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * 訂單合併操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 建立新 Order（包含所有來源訂單的 LineItems）
 * - 搬移所有 LineItems 的 orderId 至新 Order
 * - 將所有來源 Orders 狀態變更為 cancelled
 *
 * 驗證規則：
 * - 至少兩筆訂單、不可重複
 * - 所有來源訂單屬於同一客戶
 * - 狀態皆為 pending 或 confirmed
 */
export const handler: Schema["mergeOrders"]["functionHandler"] = async (
  event,
) => {
  const orderTable = process.env["ORDER_TABLE_NAME"];
  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const { orderIds } = event.arguments;

  logInfo(FUNCTION_NAME, "handler started", { orderIds });

  if (!orderTable || !lineItemTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasLineItemTable: !!lineItemTable,
    });
    return fail("缺少必要的環境變數設定");
  }

  try {
    // 1. 基本輸入驗證
    if (orderIds.length < 2) {
      logWarn(FUNCTION_NAME, "not enough orders", { orderIds });
      return fail("至少需要選取兩筆訂單才能合併");
    }

    if (new Set(orderIds).size !== orderIds.length) {
      logWarn(FUNCTION_NAME, "duplicate order selected", { orderIds });
      return fail("不可重複選取同一筆訂單");
    }

    // 2. 並行取得所有來源訂單與明細資料
    const fetchResults = await Promise.all(
      orderIds.map((oid) =>
        fetchOrderWithLineItems(oid, orderTable, lineItemTable),
      ),
    );

    // 檢查是否有找不到的訂單
    for (let i = 0; i < fetchResults.length; i++) {
      if (!fetchResults[i]) {
        const missingId = orderIds[i]!;
        logWarn(FUNCTION_NAME, "source order not found", {
          orderId: missingId,
        });
        return fail(`找不到訂單：${missingId}`);
      }
    }

    const fetched = fetchResults as FetchedOrderData[];
    const orderRecords = fetched.map((f) => f.record);
    const allLineItemRecords = fetched.flatMap((f) => f.lineItems);

    logDebug(FUNCTION_NAME, "all orders loaded", {
      orderCount: orderRecords.length,
      totalLineItems: allLineItemRecords.length,
    });

    // 3. 業務邏輯驗證
    const orders = fetched.map((f) =>
      mapOrder(f.record, f.lineItems.map(mapLineItem)),
    );

    const validation = validateMergeOrders(orders);
    if (!validation.valid) {
      logWarn(FUNCTION_NAME, "validation failed", {
        orderIds,
        validationError: validation.error,
      });
      return fail(validation.error ?? "驗證失敗");
    }

    // 4. 準備合併資料
    const totalAmount = allLineItemRecords.reduce(
      (sum, li) => sum + Number(li["subtotal"] ?? 0),
      0,
    );
    const now = new Date().toISOString();
    const newOrderId = crypto.randomUUID();
    const firstOrder = orders[0]!;

    // 5. 組裝交易項目
    const newOrderItem = buildNewOrderItem(
      orderTable,
      newOrderId,
      firstOrder,
      totalAmount,
      now,
    );
    const lineItemMoveItems = buildLineItemMoveItems(
      lineItemTable,
      allLineItemRecords,
      newOrderId,
      now,
    );
    const cancelOrderItems = buildCancelOrderItems(
      orderTable,
      orderRecords,
      now,
    );

    const transactItems = [
      newOrderItem,
      ...lineItemMoveItems,
      ...cancelOrderItems,
    ];

    // 6. 檢查交易項目數量限制
    if (transactItems.length > DYNAMO_TRANSACTION_LIMIT) {
      logWarn(FUNCTION_NAME, "transaction item limit exceeded", {
        orderIds,
        transactItemCount: transactItems.length,
      });
      return fail(
        `合併操作涉及 ${String(transactItems.length)} 個項目，超過 DynamoDB 交易限制（${String(DYNAMO_TRANSACTION_LIMIT)}）。請減少合併的訂單數量。`,
      );
    }

    // 7. 執行交易
    logDebug(FUNCTION_NAME, "executing transaction", {
      sourceOrderIds: orderIds,
      newOrderId,
      totalAmount,
      lineItemCount: allLineItemRecords.length,
      transactItemCount: transactItems.length,
    });

    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    // 從 Put item 中取得 orderNumber（避免重複呼叫 generateOrderNumber）
    const newOrderRecord = unmarshall(newOrderItem.Put!.Item!);
    const newOrderNumber = newOrderRecord["orderNumber"] as string;

    logInfo(FUNCTION_NAME, "handler succeeded", {
      sourceOrderIds: orderIds,
      newOrderId,
      newOrderNumber,
      mergedOrderCount: orders.length,
      lineItemCount: allLineItemRecords.length,
      totalAmount,
    });

    return succeed("訂單合併成功", {
      id: newOrderId,
      customerId: firstOrder.customerId,
      orderNumber: newOrderNumber,
      customerName: firstOrder.customerName,
      status: "pending",
      statusHistory: [
        { fromStatus: "created", toStatus: "pending", changedAt: now },
      ],
      lineItems: [],
      createdAt: now,
      updatedAt: now,
      totalAmount,
      mergedOrderCount: orders.length,
      lineItemCount: allLineItemRecords.length,
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        orderIds,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return fail("訂單合併失敗：訂單狀態已變更，請重新取得最新資料後重試");
    }
    logError(FUNCTION_NAME, "handler failed", error, { orderIds });
    return fail(`訂單合併失敗：${err.message ?? "未知錯誤"}`);
  }
};
