import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  normalizeLineItemStatus,
  normalizeOrderStatus,
  type OrderStatus,
} from "@shared/models/order";

const ddb = new DynamoDBClient({});

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

function deriveOrderStatusAfterShipmentCancel(
  lineItems: ReadonlyArray<{ status: ReturnType<typeof normalizeLineItemStatus> }>,
): OrderStatus {
  const allShipped = lineItems.every((item) => item.status === "shipped");
  const someShipped = lineItems.some((item) => item.status === "shipped");

  if (allShipped) {
    return "completed";
  }

  if (someShipped) {
    return "shipping";
  }

  return "confirmed";
}

/**
 * 取消出貨 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 將已出貨數量全數加回 Product.stockQuantity
 * - LineItem shippedQuantity 歸零、移除 shippedAt、status 回到 received
 * - 依撤銷後所有明細狀態回推 Order.status
 */
export const handler: Schema["cancelShipment"]["functionHandler"] = async (
  event,
) => {
  const { orderId, lineItemId } = event.arguments;

  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];
  const orderTable = process.env["ORDER_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];

  if (!lineItemTable || !orderTable || !productTable) {
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
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
    const status = normalizeLineItemStatus(lineItem["status"]);
    const shippedQuantity = Number(lineItem["shippedQuantity"] ?? 0);
    const productId = String(lineItem["productId"] ?? "");
    const lineItemOrderId = String(lineItem["orderId"] ?? "");

    if (lineItemOrderId !== orderId) {
      return JSON.stringify({
        success: false,
        message: "明細項目不屬於指定訂單",
      });
    }

    if (shippedQuantity <= 0) {
      return JSON.stringify({
        success: false,
        message: "此明細尚未出貨，無法取消出貨",
      });
    }

    if (status !== "shipped" && status !== "received") {
      return JSON.stringify({
        success: false,
        message: "僅已出貨或部分出貨的明細可取消出貨",
      });
    }

    if (!productId) {
      return JSON.stringify({
        success: false,
        message: "明細商品資料不完整，無法取消出貨",
      });
    }

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
    const simulatedLineItems = allLineItems.map((item) => ({
      status:
        item["id"] === lineItemId
          ? ("received" as const)
          : normalizeLineItemStatus(item["status"]),
    }));
    const derivedOrderStatus =
      deriveOrderStatusAfterShipmentCancel(simulatedLineItems);

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
    if (currentOrderStatus === "cancelled") {
      return JSON.stringify({
        success: false,
        message: "已取消訂單不可取消出貨",
      });
    }

    const now = new Date().toISOString();
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
            ":qty": shippedQuantity,
            ":now": now,
          }),
        },
      },
      {
        Update: {
          TableName: lineItemTable,
          Key: marshall({ id: lineItemId }),
          UpdateExpression:
            "SET shippedQuantity = :zero, #st = :received, updatedAt = :now REMOVE shippedAt",
          ConditionExpression:
            "orderId = :orderId AND shippedQuantity = :shippedQuantity AND shippedQuantity > :zero",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":orderId": orderId,
            ":shippedQuantity": shippedQuantity,
            ":zero": 0,
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

    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    return JSON.stringify({
      success: true,
      message: "取消出貨成功",
      data: {
        lineItemId,
        restoredQuantity: shippedQuantity,
        lineItemStatus: "received",
        orderStatus: derivedOrderStatus,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message: "取消出貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    console.error("cancelShipment error:", error);
    return JSON.stringify({
      success: false,
      message: `取消出貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
