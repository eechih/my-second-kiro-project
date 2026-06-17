import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidOrderItemStatusTransition } from "@shared/logic/order-item-status";
import {
  deriveOrderStatusFromOrderItems,
  isValidOrderStatusTransition,
} from "@shared/logic/order-status";
import { validateShipment } from "@shared/logic/shipment";
import {
  normalizeOrderItemStatus,
  normalizeOrderStatus,
  type OrderItemStatus,
} from "@shared/models/order";
import type { Schema } from "../../data/resource";
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
const FUNCTION_NAME = "confirmShipment";

/**
 * 出貨操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 扣減 Product 的 stockQuantity（庫存統一在商品層級管理）
 * - 更新 OrderItem 狀態為 shipped，記錄 shippedAt
 * - 條件性更新 Order 狀態（任一明細已出貨 → shipping，全部已出貨 → completed）
 *
 * 不支援分批出貨——出貨即為明細的全部數量。
 * orderId 從 OrderItem 記錄中讀取，前端只需傳 orderItemId。
 */
export const handler: Schema["confirmShipment"]["functionHandler"] = async (
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
    const orderId = orderItem["orderId"] as string;
    const quantity = orderItem["quantity"] as number;

    // 2. 驗證明細狀態——僅「已收到」可出貨
    const currentStatus = normalizeOrderItemStatus(orderItem["status"]);
    logDebug(FUNCTION_NAME, "order item loaded", {
      orderId,
      orderItemId,
      currentStatus,
      rawStatus: orderItem["status"],
      orderQuantity: orderItem["quantity"],
      productId: orderItem["productId"],
    });
    if (!isValidOrderItemStatusTransition(currentStatus, "shipped")) {
      logWarn(FUNCTION_NAME, "invalid order item status", {
        orderId,
        orderItemId,
        currentStatus,
      });
      return JSON.stringify({
        success: false,
        message: `明細項目目前狀態為「${currentStatus}」，無法執行出貨操作`,
      });
    }

    // 3. 取得庫存資訊（統一在商品層級管理）
    const productId = orderItem["productId"] as string;

    const productResult = await ddb.send(
      new GetItemCommand({
        TableName: productTable,
        Key: marshall({ id: productId }),
      }),
    );
    if (!productResult.Item) {
      logWarn(FUNCTION_NAME, "product not found", {
        orderId,
        orderItemId,
        productId,
      });
      return JSON.stringify({
        success: false,
        message: "找不到指定的商品",
      });
    }
    const product = unmarshall(productResult.Item);
    const stockQuantity = product["stockQuantity"] as number;
    logDebug(FUNCTION_NAME, "product loaded", {
      orderId,
      orderItemId,
      productId,
      stockQuantity,
      requestedQuantity: quantity,
    });

    // 4. 使用共用驗證函式檢查出貨數量與庫存
    const shipmentValidation = validateShipment(quantity, stockQuantity);
    if (!shipmentValidation.valid) {
      logWarn(FUNCTION_NAME, "shipment validation failed", {
        orderId,
        orderItemId,
        productId,
        quantity,
        stockQuantity,
        validationError: shipmentValidation.error,
      });
      return JSON.stringify({
        success: false,
        message: shipmentValidation.error,
      });
    }

    // 5. 取得同一訂單的所有明細項目（用於推導訂單狀態）
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

    // 模擬出貨後的明細狀態列表（用於推導訂單狀態）
    const simulatedOrderItems = allOrderItems.map((li) => {
      if (li["id"] === orderItemId) {
        return { status: "shipped" as const };
      }
      return { status: normalizeOrderItemStatus(li["status"]) };
    });

    const derivedOrderStatus = deriveOrderStatusFromOrderItems(simulatedOrderItems);

    // 6. 取得目前訂單資料（用於狀態轉換驗證）
    const orderResult = await ddb.send(
      new GetItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
      }),
    );

    if (!orderResult.Item) {
      logWarn(FUNCTION_NAME, "order not found", { orderId, orderItemId });
      return JSON.stringify({ success: false, message: "找不到指定的訂單" });
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
        toStatus: "shipped",
      }) ?? null;
    const latestShippedAt = deriveLatestShippedAtAfterTransition({
      allOrderItems: summaryOrderItems,
      orderItemId,
      toShippedAt: now,
      toStatus: "shipped",
    });

    // 7. 建立交易項目
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 7a. 扣減庫存（商品層級）
    transactItems.push({
      Update: {
        TableName: productTable,
        Key: marshall({ id: productId }),
        UpdateExpression:
          "SET stockQuantity = stockQuantity - :qty, updatedAt = :now",
        ConditionExpression: "attribute_exists(id) AND stockQuantity >= :qty",
        ExpressionAttributeValues: marshall({
          ":qty": quantity,
          ":now": now,
        }),
      },
    });

    // 7b. 更新 OrderItem
    const orderItemUpdateStatus: OrderItemStatus = "shipped";
    transactItems.push({
      Update: {
        TableName: orderItemTable,
        Key: marshall({ id: orderItemId }),
        UpdateExpression:
          "SET #st = :newStatus, shippedAt = :now, updatedAt = :now",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":newStatus": orderItemUpdateStatus,
          ":now": now,
        }),
      },
    });

    // 7c. 條件性更新 Order 狀態
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
            Key: marshall({ id: orderId }),
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

    // 8. 執行交易
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      orderItemId,
      productId,
      quantity,
      orderItemUpdateStatus,
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
      quantity,
      orderItemStatus: orderItemUpdateStatus,
      orderStatus: derivedOrderStatus ?? currentOrderStatus,
    });
    return JSON.stringify({
      success: true,
      message: "出貨操作成功",
      data: {
        orderItemId,
        quantity,
        orderItemStatus: orderItemUpdateStatus,
        orderStatus: derivedOrderStatus ?? currentOrderStatus,
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
        message: "出貨操作失敗：庫存不足或資料已變更，請重新取得最新資料後重試",
      });
    }
    logError(FUNCTION_NAME, "handler failed", error, {
      orderItemId,
    });
    return JSON.stringify({
      success: false,
      message: `出貨操作失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
