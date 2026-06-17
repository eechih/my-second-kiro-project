import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  deriveFulfillmentStatusFromOrderItems,
  deriveOrderStatusFromSummary,
} from "@shared/logic/order-status";
import {
  normalizeFulfillmentStatus,
  normalizeOrderItemStatus,
  normalizeOrderStatus,
  normalizePaymentStatus,
} from "@shared/models/order";
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
  deriveLatestReadyToShipReceivedAtAfterTransition,
} from "../customer-fulfillment-summary";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "cancelReceived";

/**
 * 撤銷入庫確認 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - OrderItem status 從 received 改回 ordered，移除 receivedAt
 * - 扣回 Product.stockQuantity（扣回 orderItem.quantity）
 *
 * 僅允許狀態為 received 的明細撤銷（shipped 狀態不可撤銷）。
 */
export const handler: Schema["cancelReceived"]["functionHandler"] = async (
  event,
) => {
  const { orderItemId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderItemId });

  const orderItemTable = process.env["ORDER_ITEM_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];
  const orderTable = process.env["ORDER_TABLE_NAME"];
  const summaryTable = process.env["CUSTOMER_FULFILLMENT_SUMMARY_TABLE_NAME"];

  if (!orderItemTable || !productTable || !orderTable || !summaryTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderItemTable: !!orderItemTable,
      hasProductTable: !!productTable,
      hasOrderTable: !!orderTable,
      hasSummaryTable: !!summaryTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 OrderItem 資料
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
      orderItemId,
      orderId,
      productId,
      status,
      rawStatus: orderItem["status"],
      quantity,
    });

    // 2. 驗證狀態——僅 received 可撤銷
    if (status !== "received") {
      logWarn(FUNCTION_NAME, "invalid order item status", {
        orderItemId,
        productId,
        status,
      });
      return JSON.stringify({
        success: false,
        message: "僅已到貨的明細可取消到貨",
      });
    }

    if (!productId) {
      return JSON.stringify({
        success: false,
        message: "明細商品資料不完整，無法取消到貨",
      });
    }

    if (!orderId) {
      return JSON.stringify({
        success: false,
        message: "明細項目缺少訂單關聯",
      });
    }

    const now = new Date().toISOString();
    const orderResult = await ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
      }),
    );
    if (!orderResult.Item) {
      return JSON.stringify({
        success: false,
        message: "找不到指定的訂單",
      });
    }
    const order = unmarshall(orderResult.Item);
    const currentOrderStatus = normalizeOrderStatus(order["status"]);
    const currentPaymentStatus = normalizePaymentStatus(order["paymentStatus"]);
    const currentFulfillmentStatus = normalizeFulfillmentStatus(
      order["fulfillmentStatus"],
    );
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
    const summaryOrderItems = allOrderItems.map((li) => ({
      id: String(li["id"] ?? ""),
      status: normalizeOrderItemStatus(li["status"]) as
        | "ordered"
        | "received"
        | "shipped",
      quantity: Number(li["quantity"] ?? 0),
      receivedAt:
        li["receivedAt"] != null ? String(li["receivedAt"]) : undefined,
    }));
    const simulatedOrderItems = allOrderItems.map((li) => ({
      status:
        li["id"] === orderItemId
          ? ("ordered" as const)
          : normalizeOrderItemStatus(li["status"]),
    }));
    const derivedFulfillmentStatus =
      deriveFulfillmentStatusFromOrderItems(simulatedOrderItems);
    const derivedOrderStatus = deriveOrderStatusFromSummary({
      paymentStatus: currentPaymentStatus,
      fulfillmentStatus: derivedFulfillmentStatus,
      cancelledAt: order["cancelledAt"] != null ? String(order["cancelledAt"]) : null,
    });
    const summaryResult = await ddb.send(
      new GetItemCommand({
        TableName: summaryTable,
        Key: marshall({ id: customerId }),
      }),
    );
    const summaryDelta = buildShipmentSummaryDelta({
      allOrderItems: summaryOrderItems,
      fromOrderStatus: currentOrderStatus,
      fromFulfillmentStatus: currentFulfillmentStatus,
      toOrderStatus: derivedOrderStatus,
      toFulfillmentStatus: derivedFulfillmentStatus,
    });
    const latestReadyToShipReceivedAt =
      deriveLatestReadyToShipReceivedAtAfterTransition({
        allOrderItems: summaryOrderItems,
        orderItemId,
        toStatus: "ordered",
      }) ?? null;

    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [
      {
        Update: {
          TableName: orderItemTable,
          Key: marshall({ id: orderItemId }),
          UpdateExpression:
            "SET #st = :ordered, updatedAt = :now REMOVE receivedAt",
          ConditionExpression: "#st = :received OR #st = :legacyReceived",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":ordered": "ordered",
            ":received": "received",
            ":legacyReceived": "已收到",
            ":now": now,
          }),
        },
      },
      {
        Update: {
          TableName: productTable,
          Key: marshall({ id: productId }),
          UpdateExpression:
            "SET stockQuantity = stockQuantity - :qty, updatedAt = :now",
          ConditionExpression:
            "attribute_exists(id) AND stockQuantity >= :qty",
          ExpressionAttributeValues: marshall({
            ":qty": quantity,
            ":now": now,
          }),
        },
      },
    ];

    if (
      derivedFulfillmentStatus !== currentFulfillmentStatus ||
      derivedOrderStatus !== currentOrderStatus
    ) {
      const existingHistory =
        Array.isArray(order["statusHistory"])
          ? (order["statusHistory"] as Record<string, unknown>[])
          : [];
      const updatedHistory =
        derivedOrderStatus !== currentOrderStatus
          ? [
              ...existingHistory,
              {
                fromStatus: currentOrderStatus,
                toStatus: derivedOrderStatus,
                changedAt: now,
              },
            ]
          : existingHistory;

      transactItems.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ id: orderId }),
          UpdateExpression:
            "SET #st = :newStatus, fulfillmentStatus = :fulfillmentStatus, statusHistory = :history, updatedAt = :now",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":newStatus": derivedOrderStatus,
            ":fulfillmentStatus": derivedFulfillmentStatus,
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
    });
    if (summaryTransactItem) {
      transactItems.push(summaryTransactItem);
    }

    // 3. 執行交易：OrderItem 狀態回 ordered + 庫存扣回 + 同步訂單狀態
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderItemId,
      orderId,
      productId,
      quantity,
      currentOrderStatus,
      currentFulfillmentStatus,
      derivedOrderStatus,
      derivedFulfillmentStatus,
      transactItemCount: transactItems.length,
    });
    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: transactItems,
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderItemId,
      orderId,
      productId,
      quantity,
      orderItemStatus: "ordered",
      orderStatus: derivedOrderStatus,
      fulfillmentStatus: derivedFulfillmentStatus,
    });
    return JSON.stringify({
      success: true,
      message: "取消到貨成功",
      data: {
        orderItemId,
        quantity,
        orderItemStatus: "ordered",
        orderStatus: derivedOrderStatus,
        fulfillmentStatus: derivedFulfillmentStatus,
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
        message: "取消到貨失敗，庫存不足或資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderItemId });
    return JSON.stringify({
      success: false,
      message: `取消到貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
