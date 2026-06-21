import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  validateOrdersForShipment,
  validateOrderNotInActiveShipment,
  validateShipmentOrderCount,
} from "@shared/logic/shipment-validation";
import type { Order, OrderFulfillmentStatus } from "@shared/models/order";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "createShipment";

/**
 * 建立出貨單 Lambda 函式
 *
 * 驗證所有 Orders 狀態為 RECEIVED、驗證無重複關聯、
 * 驗證數量 1–50、透過 SequenceCounter 產生 shipmentNumber、
 * 建立 Shipment、設定各 Order 的 shipmentId。
 *
 * 需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 6.3, 6.4, 6.5
 */
export const handler: Schema["createShipment"]["functionHandler"] = async (
  event,
) => {
  const {
    recipientName,
    recipientPhone,
    recipientAddress,
    shippingMethod,
    trackingNumber,
    actualShippingCost,
    note,
    orderIds,
  } = event.arguments;

  logInfo(FUNCTION_NAME, "handler started", {
    recipientName,
    orderCount: orderIds.length,
  });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const shipmentTable = process.env["SHIPMENT_TABLE_NAME"];
  const sequenceCounterTable = process.env["SEQUENCECOUNTER_TABLE_NAME"];

  if (!orderTable || !shipmentTable || !sequenceCounterTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasShipmentTable: !!shipmentTable,
      hasSequenceCounterTable: !!sequenceCounterTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 驗證 orderIds 數量為 1–50
    const countValidation = validateShipmentOrderCount(orderIds.length);
    if (!countValidation.valid) {
      logWarn(FUNCTION_NAME, "order count validation failed", {
        orderCount: orderIds.length,
        error: countValidation.error,
      });
      return JSON.stringify({
        success: false,
        message: countValidation.error,
      });
    }

    // 2. 逐筆取得所有 Orders
    const orders: Record<string, unknown>[] = [];
    for (const orderId of orderIds) {
      const orderResult = await ddb.send(
        new GetItemCommand({
          TableName: orderTable,
          Key: marshall({ id: orderId }),
        }),
      );

      if (!orderResult.Item) {
        logWarn(FUNCTION_NAME, "order not found", { orderId });
        return JSON.stringify({
          success: false,
          message: `找不到指定的訂單（ID: ${orderId}）`,
        });
      }

      orders.push(unmarshall(orderResult.Item));
    }

    logDebug(FUNCTION_NAME, "all orders loaded", {
      orderCount: orders.length,
    });

    // 3. 驗證所有 Orders 狀態為 RECEIVED
    const statusValidation = validateOrdersForShipment(
      orders.map((o) => ({
        orderNumber: o["orderNumber"] as string,
        status: o["status"] as OrderFulfillmentStatus,
      })) as unknown as Order[],
    );

    if (!statusValidation.valid) {
      logWarn(FUNCTION_NAME, "order status validation failed", {
        error: statusValidation.error,
      });
      return JSON.stringify({
        success: false,
        message: statusValidation.error,
      });
    }

    // 4. 驗證每筆 Order 未關聯至未取消的 Shipment
    for (const order of orders) {
      const shipmentId = order["shipmentId"] as string | null;

      if (shipmentId) {
        // 取得關聯的 Shipment
        const shipmentResult = await ddb.send(
          new GetItemCommand({
            TableName: shipmentTable,
            Key: marshall({ id: shipmentId }),
          }),
        );

        const existingShipment = shipmentResult.Item
          ? unmarshall(shipmentResult.Item)
          : null;

        const duplicateValidation = validateOrderNotInActiveShipment(
          {
            orderNumber: order["orderNumber"] as string,
            shipmentId,
          },
          existingShipment
            ? {
                shipmentNumber: existingShipment["shipmentNumber"] as string,
                status: existingShipment["status"] as
                  | "PENDING"
                  | "SHIPPED"
                  | "DELIVERED"
                  | "CANCELLED",
              }
            : null,
        );

        if (!duplicateValidation.valid) {
          logWarn(FUNCTION_NAME, "order already in active shipment", {
            orderId: order["id"],
            shipmentId,
            error: duplicateValidation.error,
          });
          return JSON.stringify({
            success: false,
            message: duplicateValidation.error,
          });
        }
      }
    }

    // 5. 透過 SequenceCounter 產生 shipmentNumber（原子遞增）
    const counterResult = await ddb.send(
      new UpdateItemCommand({
        TableName: sequenceCounterTable,
        Key: marshall({ id: "shipment" }),
        UpdateExpression:
          "SET currentValue = if_not_exists(currentValue, :zero) + :inc",
        ExpressionAttributeValues: marshall({
          ":zero": 0,
          ":inc": 1,
        }),
        ReturnValues: "UPDATED_NEW",
      }),
    );

    const sequenceValue = counterResult.Attributes
      ? (unmarshall(counterResult.Attributes)["currentValue"] as number)
      : 1;

    // 6. 格式化 shipmentNumber：SH + 6 碼零填充
    const shipmentNumber = `SH${String(sequenceValue).padStart(6, "0")}`;

    logDebug(FUNCTION_NAME, "shipment number generated", {
      shipmentNumber,
      sequenceValue,
    });

    // 7. 建立 Shipment 記錄
    const now = new Date().toISOString();
    const shipmentId = crypto.randomUUID();

    const shipmentItem = {
      id: shipmentId,
      shipmentNumber,
      recipientName,
      recipientPhone: recipientPhone ?? null,
      recipientAddress: recipientAddress ?? null,
      status: "PENDING",
      shippingMethod: shippingMethod ?? null,
      trackingNumber: trackingNumber ?? null,
      actualShippingCost: actualShippingCost ?? 0,
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      note: note ?? null,
      gsiPartition: "Shipment",
      createdAtForSort: now,
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutItemCommand({
        TableName: shipmentTable,
        Item: marshall(shipmentItem, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );

    logDebug(FUNCTION_NAME, "shipment created", {
      shipmentId,
      shipmentNumber,
    });

    // 8. 更新所有 Orders 的 shipmentId（使用 TransactWriteItems）
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    for (const order of orders) {
      const orderId = order["id"] as string;
      transactItems.push({
        Update: {
          TableName: orderTable,
          Key: marshall({ id: orderId }),
          UpdateExpression: "SET shipmentId = :sid, updatedAt = :now",
          ConditionExpression: "#st = :expectedStatus",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":sid": shipmentId,
            ":expectedStatus": "RECEIVED",
            ":now": now,
          }),
        },
      });
    }

    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: transactItems,
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      shipmentId,
      shipmentNumber,
      orderCount: orders.length,
      status: "PENDING",
    });

    // 9. 回傳成功結果
    return JSON.stringify({
      success: true,
      message: "出貨單建立成功",
      data: {
        shipmentId,
        shipmentNumber,
        recipientName,
        recipientPhone: recipientPhone ?? null,
        recipientAddress: recipientAddress ?? null,
        status: "PENDING",
        shippingMethod: shippingMethod ?? null,
        trackingNumber: trackingNumber ?? null,
        actualShippingCost: actualShippingCost ?? 0,
        note: note ?? null,
        orderIds: orders.map((o) => o["id"] as string),
        createdAt: now,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "建立出貨單失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, {
      recipientName,
      orderCount: orderIds.length,
    });
    return JSON.stringify({
      success: false,
      message: `建立出貨單失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
