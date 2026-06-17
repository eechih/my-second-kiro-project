import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  normalizeOrderItemStatus,
  normalizeOrderStatus,
  type OrderStatus,
} from "@shared/models/order";
import {
  deriveOrderStatusFromOrderItems,
} from "@shared/logic/order-status";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";
import {
  buildShipmentSummaryDelta,
  buildShipmentSummaryTransactItem,
  deriveLatestShippedAtAfterTransition,
  deriveLatestReadyToShipReceivedAtAfterTransition,
} from "../customer-fulfillment-summary";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "cancelShipment";

function parseStatusHistory(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw as Record<string, unknown>[];
  }

  if (typeof raw !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

/**
 * 取消出貨 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 將明細數量加回 Product.stockQuantity
 * - OrderItem 移除 shippedAt、status 回到 received
 * - 依撤銷後所有明細狀態回推 Order.status
 *
 * orderId 從 OrderItem 記錄中讀取，前端只需傳 orderItemId。
 */
export const handler: Schema["cancelShipment"]["functionHandler"] = async (
  event,
) => {
  const { orderItemId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderItemId });

  const orderItemTable = process.env["ORDER_ITEM_TABLE_NAME"];
  const orderTable = process.env["ORDER_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];
  const summaryTable = process.env["CUSTOMER_FULFILLMENT_SUMMARY_TABLE_NAME"];

  if (!orderItemTable || !orderTable || !productTable || !summaryTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderItemTable: !!orderItemTable,
      hasOrderTable: !!orderTable,
      hasProductTable: !!productTable,
      hasSummaryTable: !!summaryTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    const orderItemResult = await ddb.send(
      new GetItemCommand({
        TableName: orderItemTable,
        Key: marshall({ id: orderItemId }),
      }),
    );

    if (!orderItemResult.Item) {
      logWarn(FUNCTION_NAME, "order item not found", { orderItemId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的明細項目",
      });
    }

    const orderItem = unmarshall(orderItemResult.Item);
    const status = normalizeOrderItemStatus(orderItem["status"]);
    const quantity = Number(orderItem["quantity"] ?? 0);
    const productId = String(orderItem["productId"] ?? "");
    const orderId = String(orderItem["orderId"] ?? "");
    logDebug(FUNCTION_NAME, "order item loaded", {
      orderId,
      orderItemId,
      status,
      rawStatus: orderItem["status"],
      quantity,
      productId,
    });

    if (quantity <= 0) {
      return JSON.stringify({
        success: false,
        message: "此明細尚未出貨，無法取消出貨",
      });
    }

    if (status !== "shipped") {
      return JSON.stringify({
        success: false,
        message: "僅已出貨的明細可取消出貨",
      });
    }

    if (!productId) {
      return JSON.stringify({
        success: false,
        message: "明細商品資料不完整，無法取消出貨",
      });
    }

    const allOrderItemsResult = await ddb.send(
      new QueryCommand({
        TableName: orderItemTable,
        IndexName: "byOrderId",
        KeyConditionExpression: "orderId = :orderId",
        ExpressionAttributeValues: marshall({ ":orderId": orderId }),
      }),
    );

    const allOrderItems = (allOrderItemsResult.Items ?? []).map((rawItem) =>
      unmarshall(rawItem),
    );
    const summaryOrderItems = allOrderItems.map((item) => ({
      id: String(item["id"] ?? ""),
      status: normalizeOrderItemStatus(item["status"]) as
        | "ordered"
        | "received"
        | "shipped",
      quantity: Number(item["quantity"] ?? 0),
      receivedAt:
        item["receivedAt"] != null ? String(item["receivedAt"]) : undefined,
    }));
    const simulatedOrderItems = allOrderItems.map((item) => ({
      status:
        item["id"] === orderItemId
          ? ("received" as const)
          : normalizeOrderItemStatus(item["status"]),
    }));
    const derivedOrderStatus: OrderStatus =
      deriveOrderStatusFromOrderItems(simulatedOrderItems);

    const orderResult = await ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
      }),
    );

    if (!orderResult.Item) {
      logWarn(FUNCTION_NAME, "order not found", { orderId, orderItemId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的訂單",
      });
    }

    const order = unmarshall(orderResult.Item);
    const currentOrderStatus = normalizeOrderStatus(order["status"]);
    const customerId = String(order["customerId"] ?? "");
    const customerNameSnapshot = String(
      order["customerNameSnapshot"] ?? "未命名客戶",
    );
    if (!customerId) {
      return JSON.stringify({
        success: false,
        message: "訂單缺少客戶關聯，無法更新出貨摘要",
      });
    }
    logDebug(FUNCTION_NAME, "order status derived", {
      orderId,
      orderItemId,
      currentOrderStatus,
      derivedOrderStatus,
      orderItemCount: allOrderItems.length,
    });
    if (currentOrderStatus === "CANCELLED") {
      return JSON.stringify({
        success: false,
        message: "已取消訂單不可取消出貨",
      });
    }

    const now = new Date().toISOString();
    const summaryResult = await ddb.send(
      new GetItemCommand({
        TableName: summaryTable,
        Key: marshall({ id: customerId }),
      }),
    );
    const summaryDelta = buildShipmentSummaryDelta({
      allOrderItems: summaryOrderItems,
      fromOrderStatus: currentOrderStatus,
      toOrderStatus: derivedOrderStatus,
    });
    const latestReadyToShipReceivedAt =
      deriveLatestReadyToShipReceivedAtAfterTransition({
        allOrderItems: summaryOrderItems,
        orderItemId,
        toReceivedAt:
          orderItem["receivedAt"] != null
            ? String(orderItem["receivedAt"])
            : undefined,
        toStatus: "received",
      }) ?? null;
    const latestShippedAt = deriveLatestShippedAtAfterTransition({
      allOrderItems: summaryOrderItems,
      orderItemId,
      toStatus: "received",
    });
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [
      {
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
      },
      {
        Update: {
          TableName: orderItemTable,
          Key: marshall({ id: orderItemId }),
          UpdateExpression:
            "SET #st = :received, updatedAt = :now REMOVE shippedAt",
          ConditionExpression: "orderId = :orderId AND #st = :shipped",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":orderId": orderId,
            ":shipped": "shipped",
            ":received": "received",
            ":now": now,
          }),
        },
      },
    ];

    if (derivedOrderStatus !== currentOrderStatus) {
      const updatedHistory = [
        ...parseStatusHistory(order["statusHistory"]),
        {
          fromStatus: currentOrderStatus,
          toStatus: derivedOrderStatus,
          changedAt: now,
        },
      ];

      transactItems.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ id: orderId }),
          UpdateExpression:
            "SET #st = :newStatus, statusHistory = :history, updatedAt = :now",
          ConditionExpression: "#st = :currentStatus",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":newStatus": derivedOrderStatus,
            ":currentStatus": currentOrderStatus,
            ":history": updatedHistory,
            ":now": now,
          }),
        },
      });
    }

    const summaryTransactItem = buildShipmentSummaryTransactItem({
      customerId,
      customerNameSnapshot,
      now,
      summaryResult,
      summaryTableName: summaryTable,
      delta: summaryDelta,
      latestReadyToShipReceivedAt,
      latestShippedAt,
    });
    if (summaryTransactItem) {
      transactItems.push(summaryTransactItem);
    }

    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      orderItemId,
      productId,
      quantity,
      currentOrderStatus,
      derivedOrderStatus,
      transactItemCount: transactItems.length,
    });
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      orderItemId,
      productId,
      restoredQuantity: quantity,
      orderItemStatus: "received",
      orderStatus: derivedOrderStatus,
    });
    return JSON.stringify({
      success: true,
      message: "取消出貨成功",
      data: {
        orderItemId,
        restoredQuantity: quantity,
        orderItemStatus: "received",
        orderStatus: derivedOrderStatus,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        orderItemId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "取消出貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderItemId });
    return JSON.stringify({
      success: false,
      message: `取消出貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
