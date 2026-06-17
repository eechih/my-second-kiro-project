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
  normalizeLegacyOrderStatus,
  normalizeOrderItemStatus,
  normalizePaymentStatus,
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

function mapOrderItem(raw: DdbRecord): OrderItem {
  const selectedOptionsSnapshot = Array.isArray(
    raw["selectedOptionsSnapshot"],
  )
    ? (raw["selectedOptionsSnapshot"] as Record<string, unknown>[])
    : [];
  const variantLabel =
    selectedOptionsSnapshot.length > 0
      ? selectedOptionsSnapshot
          .map((entry) => String(entry["valueName"] ?? "").trim())
          .filter(Boolean)
          .join(" / ")
      : null;

  return {
    id: String(raw["id"] ?? ""),
    productId: String(raw["productId"] ?? ""),
    productName: String(raw["productNameSnapshot"] ?? raw["productName"] ?? ""),
    productImageUrl: raw["productImageUrlSnapshot"]
      ? String(raw["productImageUrlSnapshot"])
      : null,
    variantLabel,
    selectedOptionsSnapshot: selectedOptionsSnapshot.map((entry) => ({
      optionName: String(entry["optionName"] ?? ""),
      valueName: String(entry["valueName"] ?? ""),
      priceOffset: Number(entry["priceOffset"] ?? 0),
      costOffset: Number(entry["costOffset"] ?? 0),
    })),
    quantity: Number(raw["quantity"] ?? 0),
    unitPrice: Number(raw["unitPriceSnapshot"] ?? 0),
    unitCostSnapshot:
      raw["unitCostSnapshot"] !== null && raw["unitCostSnapshot"] !== undefined
        ? Number(raw["unitCostSnapshot"])
        : null,
    subtotal: Number(raw["totalPriceSnapshot"] ?? raw["subtotal"] ?? 0),
    totalCostSnapshot:
      raw["totalCostSnapshot"] !== null && raw["totalCostSnapshot"] !== undefined
        ? Number(raw["totalCostSnapshot"])
        : null,
    status: normalizeOrderItemStatus(raw["status"]),
    purchasedAt: raw["purchasedAt"] ? String(raw["purchasedAt"]) : null,
    receivedAt: raw["receivedAt"] ? String(raw["receivedAt"]) : null,
    shippedAt: raw["shippedAt"] ? String(raw["shippedAt"]) : null,
    outOfStockAt: raw["outOfStockAt"] ? String(raw["outOfStockAt"]) : null,
    supplierName: raw["supplierName"] ? String(raw["supplierName"]) : null,
    unitCost:
      raw["unitCostSnapshot"] !== null && raw["unitCostSnapshot"] !== undefined
        ? Number(raw["unitCostSnapshot"])
        : null,
  };
}

function mapOrderRecordToOrder(input: {
  rawOrder: DdbRecord;
  orderItems: OrderItem[];
}): Order {
  const { rawOrder, orderItems } = input;
  return {
    id: String(rawOrder["id"] ?? ""),
    orderNumber: String(rawOrder["orderNumber"] ?? ""),
    customerId: String(rawOrder["customerId"] ?? ""),
    customerName: String(rawOrder["customerName"] ?? ""),
    items: orderItems,
    totalAmount: Number(rawOrder["totalAmount"] ?? 0),
    status: normalizeLegacyOrderStatus({
      status: rawOrder["status"],
      fulfillmentStatus: rawOrder["fulfillmentStatus"],
      cancelledAt: rawOrder["cancelledAt"],
    }),
    paymentStatus: normalizePaymentStatus(rawOrder["paymentStatus"]),
    paidAt: rawOrder["paidAt"] != null ? String(rawOrder["paidAt"]) : null,
    cancelledAt:
      rawOrder["cancelledAt"] != null ? String(rawOrder["cancelledAt"]) : null,
    refundedAt:
      rawOrder["refundedAt"] != null ? String(rawOrder["refundedAt"]) : null,
    completedAt:
      rawOrder["completedAt"] != null ? String(rawOrder["completedAt"]) : null,
    statusHistory: Array.isArray(rawOrder["statusHistory"])
      ? (rawOrder["statusHistory"] as Order["statusHistory"])
      : [],
    createdAt: String(rawOrder["createdAt"] ?? ""),
    updatedAt: String(rawOrder["updatedAt"] ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface FetchedOrderData {
  record: DdbRecord;
  orderItems: DdbRecord[];
}

async function fetchOrderWithOrderItems(
  orderId: string,
  orderTable: string,
  orderItemTable: string,
): Promise<FetchedOrderData | null> {
  const [orderResult, orderItemsResult] = await Promise.all([
    ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
      }),
    ),
    ddb.send(
      new QueryCommand({
        TableName: orderItemTable,
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
    orderItems: (orderItemsResult.Items ?? []).map((item) => unmarshall(item)),
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
        customerNameSnapshot: order.customerName,
        subtotalAmount: totalAmount,
        shippingAmount: 0,
        discountAmount: 0,
        totalAmount,
        status: "PENDING",
        paymentStatus: "UNPAID",
        isActive: true,
        gsiPartition: "Order",
        createdAtForSort: now,
        statusHistory: [
          {
            fromStatus: "created",
            toStatus: "PENDING",
            changedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      }),
      ConditionExpression: "attribute_not_exists(id)",
    },
  };
}

function buildOrderItemMoveItems(
  orderItemTable: string,
  orderItems: DdbRecord[],
  newOrderId: string,
  now: string,
): TransactWriteItem[] {
  return orderItems.map((orderItem) => ({
    Update: {
      TableName: orderItemTable,
      Key: marshall({ id: orderItem["id"] as string }),
      UpdateExpression: "SET orderId = :newOrderId, updatedAt = :now",
      ConditionExpression: "orderId = :sourceOrderId",
      ExpressionAttributeValues: marshall({
        ":newOrderId": newOrderId,
        ":sourceOrderId": orderItem["orderId"] as string,
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
      { fromStatus: currentStatus, toStatus: "CANCELLED", changedAt: now },
    ];

    return {
      Update: {
        TableName: orderTable,
        Key: marshall({ id: order["id"] as string }),
        UpdateExpression:
          "SET #st = :cancelled, statusHistory = :history, cancelledAt = :now, updatedAt = :now",
        ConditionExpression: "#st = :currentStatus",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":cancelled": "CANCELLED",
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
 * - 建立新 Order（包含所有來源訂單的 OrderItems）
 * - 搬移所有 OrderItems 的 orderId 至新 Order
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
  const orderItemTable = process.env["ORDER_ITEM_TABLE_NAME"];
  const { orderIds } = event.arguments;

  logInfo(FUNCTION_NAME, "handler started", { orderIds });

  if (!orderTable || !orderItemTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasOrderItemTable: !!orderItemTable,
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
        fetchOrderWithOrderItems(oid, orderTable, orderItemTable),
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
    const allOrderItemRecords = fetched.flatMap((f) => f.orderItems);

    logDebug(FUNCTION_NAME, "all orders loaded", {
      orderCount: orderRecords.length,
      totalOrderItems: allOrderItemRecords.length,
    });

    // 3. 業務邏輯驗證
    const orders = fetched.map((f) =>
      mapOrderRecordToOrder({
        rawOrder: f.record,
        orderItems: f.orderItems.map(mapOrderItem),
      }),
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
    const totalAmount = allOrderItemRecords.reduce(
      (sum, li) =>
        sum +
        Number(
          li["totalPriceSnapshot"] ??
            li["subtotalAmount"] ??
            li["subtotal"] ??
            0,
        ),
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
    const orderItemMoveItems = buildOrderItemMoveItems(
      orderItemTable,
      allOrderItemRecords,
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
      ...orderItemMoveItems,
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
      orderItemCount: allOrderItemRecords.length,
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
      orderItemCount: allOrderItemRecords.length,
      totalAmount,
    });

    return succeed("訂單合併成功", {
      id: newOrderId,
      customerId: firstOrder.customerId,
      orderNumber: newOrderNumber,
      customerName: firstOrder.customerName,
      status: "PENDING",
      paymentStatus: "UNPAID",
      statusHistory: [
        { fromStatus: "created", toStatus: "PENDING", changedAt: now },
      ],
      orderItems: [],
      createdAt: now,
      updatedAt: now,
      totalAmount,
      mergedOrderCount: orders.length,
      orderItemCount: allOrderItemRecords.length,
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
