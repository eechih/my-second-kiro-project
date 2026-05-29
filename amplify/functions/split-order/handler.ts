import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidOrderStatusTransition } from "@shared/logic/order-status";
import {
  normalizeOrderStatus,
  type OrderStatus,
} from "@shared/models/order";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "splitOrder";

/** 分配方式（前端傳入的 JSON 結構） */
interface SplitAllocationInput {
  orderItemId: string;
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
 * - 依分配方式將 OrderItems 的 orderId 更新至對應的新 Order
 * - 將原 Order 狀態變更為 cancelled
 *
 * 包含驗證邏輯：
 * - 原訂單狀態為 pending 或 confirmed
 * - 所有 OrderItems 皆有分配目標
 * - 分拆後所有新訂單的明細項目總和等於原訂單（數量守恆）
 */
export const handler: Schema["splitOrder"]["functionHandler"] = async (
  event,
) => {
  const { orderId, allocations: allocationsRaw } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", {
    orderId,
    allocationsRaw,
  });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const orderItemTable = process.env["ORDER_ITEM_TABLE_NAME"];

  if (!orderTable || !orderItemTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasOrderItemTable: !!orderItemTable,
    });
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
        Key: marshall({ id: orderId }),
      }),
    );

    if (!orderResult.Item) {
      logWarn(FUNCTION_NAME, "order not found", { orderId });
      return JSON.stringify({ success: false, message: "找不到指定的訂單" });
    }

    const order = unmarshall(orderResult.Item);
    const currentStatus = normalizeOrderStatus(order["status"]);
    logDebug(FUNCTION_NAME, "order loaded", {
      orderId,
      currentStatus,
      rawStatus: order["status"],
    });

    // 2. 驗證訂單狀態——僅 pending 或 confirmed 可分拆
    const splittableStatuses = new Set<string>(["PENDING_PAYMENT", "PAID"]);
    if (!splittableStatuses.has(currentStatus)) {
      logWarn(FUNCTION_NAME, "order status is not splittable", {
        orderId,
        currentStatus,
      });
      return JSON.stringify({
        success: false,
        message: "僅能分拆待處理或已確認的訂單",
      });
    }

    // 3. 驗證分配列表
    if (!Array.isArray(allocations) || allocations.length === 0) {
      logWarn(FUNCTION_NAME, "empty allocations", { orderId, allocationsRaw });
      return JSON.stringify({
        success: false,
        message: "分配列表不可為空",
      });
    }

    // 4. 取得原訂單的所有明細項目
    const orderItemsResult = await ddb.send(
      new QueryCommand({
        TableName: orderItemTable,
        IndexName: "byOrderId",
        KeyConditionExpression: "orderId = :orderId",
        ExpressionAttributeValues: marshall({ ":orderId": orderId }),
      }),
    );

    const allOrderItems = (orderItemsResult.Items ?? [])
      .map((rawItem) => unmarshall(rawItem));
    logDebug(FUNCTION_NAME, "order items loaded", {
      orderId,
      orderItemCount: allOrderItems.length,
      allocationCount: allocations.length,
    });

    const orderItemMap = new Map<string, Record<string, unknown>>();
    for (const li of allOrderItems) {
      orderItemMap.set(li["id"] as string, li);
    }

    // 5. 驗證所有明細項目皆有分配目標
    const allocatedIds = new Set(allocations.map((a) => a.orderItemId));
    const orderOrderItemIds = new Set(
      allOrderItems.map((li) => li["id"] as string),
    );

    // 檢查分配列表中的明細 ID 是否存在於原訂單
    for (const allocation of allocations) {
      if (!orderOrderItemIds.has(allocation.orderItemId)) {
        logWarn(FUNCTION_NAME, "allocation references missing order item", {
          orderId,
          orderItemId: allocation.orderItemId,
        });
        return JSON.stringify({
          success: false,
          message: `明細項目 ${allocation.orderItemId} 不存在於此訂單中`,
        });
      }
    }

    // 檢查所有明細項目皆有分配目標
    for (const orderItemId of orderOrderItemIds) {
      if (!allocatedIds.has(orderItemId)) {
        logWarn(FUNCTION_NAME, "order item missing allocation", {
          orderId,
          orderItemId,
        });
        return JSON.stringify({
          success: false,
          message: "所有明細項目皆必須有分配目標",
        });
      }
    }

    // 6. 驗證至少分配到兩筆不同的新訂單
    const targetIndices = new Set(allocations.map((a) => a.targetOrderIndex));
    if (targetIndices.size < 2) {
      logWarn(FUNCTION_NAME, "not enough target orders", {
        orderId,
        targetOrderCount: targetIndices.size,
      });
      return JSON.stringify({
        success: false,
        message: "至少需要分配到兩筆不同的新訂單",
      });
    }

    // 7. 依 targetOrderIndex 分組明細項目
    const groupedOrderItems = new Map<number, Record<string, unknown>[]>();
    for (const allocation of allocations) {
      const orderItem = orderItemMap.get(allocation.orderItemId);
      if (!orderItem) continue;

      const group = groupedOrderItems.get(allocation.targetOrderIndex);
      if (group) {
        group.push(orderItem);
      } else {
        groupedOrderItems.set(allocation.targetOrderIndex, [orderItem]);
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
      id: string;
      orderNumber: string;
      customerId: string;
      customerName: string;
      status: OrderStatus;
      statusHistory: Record<string, unknown>[];
      orderItems: Record<string, unknown>[];
      createdAt: string;
      updatedAt: string;
      totalAmount: number;
      orderItemCount: number;
    }[] = [];

    // 8a. 為每個分組建立新訂單
    const sortedIndices = [...groupedOrderItems.keys()].sort((a, b) => a - b);
    for (const index of sortedIndices) {
      const orderItems = groupedOrderItems.get(index)!;
      const newOrderNumber = generateOrderNumber();
      const newOrderId = crypto.randomUUID();

      // 計算新訂單總金額
      let totalAmount = 0;
      for (const li of orderItems) {
        const itemTotal =
          typeof li["totalPriceSnapshot"] === "number"
            ? (li["totalPriceSnapshot"] as number)
            : (li["quantity"] as number) * (li["unitPriceSnapshot"] as number);
        totalAmount += itemTotal;
      }

      // 建立新訂單
      transactItems.push({
        Put: {
          TableName: orderTable,
          Item: marshall({
            id: newOrderId,
            customerId,
            orderNumber: newOrderNumber,
            customerName,
            totalAmount,
            status: "PENDING_PAYMENT",
            paymentStatus: "UNPAID",
            fulfillmentStatus: "UNFULFILLED",
            gsiPartition: "Order",
            createdAtForSort: now,
            statusHistory: [
              {
                fromStatus: "created",
                toStatus: "PENDING_PAYMENT",
                changedAt: now,
              },
            ],
            createdAt: now,
            updatedAt: now,
          }),
        },
      });

      newOrders.push({
        id: newOrderId,
        orderNumber: newOrderNumber,
        customerId,
        customerName,
        status: "PENDING_PAYMENT",
        statusHistory: [],
        orderItems: [],
        createdAt: now,
        updatedAt: now,
        totalAmount,
        orderItemCount: orderItems.length,
      });

      // 搬移明細項目至新訂單
      for (const li of orderItems) {
        transactItems.push({
          Update: {
            TableName: orderItemTable,
            Key: marshall({ id: li["id"] as string }),
            UpdateExpression: "SET orderId = :newOrderId, updatedAt = :now",
            ExpressionAttributeValues: marshall({
              ":newOrderId": newOrderId,
              ":now": now,
            }),
          },
        });
      }
    }

    // 8b. 將原訂單狀態變更為 cancelled
    if (isValidOrderStatusTransition(currentStatus, "CANCELLED")) {
      const existingHistory =
        (order["statusHistory"] as Record<string, unknown>[]) ?? [];
      const newHistoryEntry = {
        fromStatus: currentStatus,
        toStatus: "CANCELLED",
        changedAt: now,
      };
      const updatedHistory = [...existingHistory, newHistoryEntry];

      transactItems.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ id: orderId }),
          UpdateExpression:
            "SET #st = :cancelled, statusHistory = :history, cancelledAt = :now, updatedAt = :now",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":cancelled": "CANCELLED",
            ":history": updatedHistory,
            ":now": now,
          }),
        },
      });
    }

    // 9. 檢查交易項目數量限制
    if (transactItems.length > 100) {
      logWarn(FUNCTION_NAME, "transaction item limit exceeded", {
        orderId,
        transactItemCount: transactItems.length,
      });
      return JSON.stringify({
        success: false,
        message: `分拆操作涉及 ${String(transactItems.length)} 個項目，超過 DynamoDB 交易限制（100）。請減少分拆的明細項目數量。`,
      });
    }

    // 10. 執行交易
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      currentStatus,
      newOrderCount: newOrders.length,
      orderItemCount: allOrderItems.length,
      transactItemCount: transactItems.length,
    });
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      originalOrderId: orderId,
      newOrderCount: newOrders.length,
      newOrderIds: newOrders.map((order) => order.id),
      orderItemCount: allOrderItems.length,
    });
    return JSON.stringify({
      success: true,
      message: "訂單分拆成功",
      data: {
        originalOrderId: orderId,
        newOrders,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        orderId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message:
          "訂單分拆失敗：訂單狀態已變更，請重新取得最新資料後重試",
      });
    }
    logError(FUNCTION_NAME, "handler failed", error, { orderId });
    return JSON.stringify({
      success: false,
      message: `訂單分拆失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
