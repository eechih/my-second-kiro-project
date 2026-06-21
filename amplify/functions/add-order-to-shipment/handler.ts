import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  validateOrdersForShipment,
  validateOrderNotInActiveShipment,
  validateShipmentOrderCount,
} from "@shared/logic/shipment-validation";
import { logDebug, logError, logInfo, logWarn } from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "addOrderToShipment";

/**
 * 追加 Order 至 Shipment Lambda 函式
 *
 * 驗證 Order 狀態為 RECEIVED、未關聯其他未取消 Shipment、
 * Shipment 為 PENDING 且未超過 50 筆，然後設定 Order.shipmentId。
 *
 * 需求：4.4, 4.5, 4.6, 6.3, 6.4, 6.5
 */
export const handler: Schema["addOrderToShipment"]["functionHandler"] = async (
  event,
) => {
  const { shipmentId, orderId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { shipmentId, orderId });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const shipmentTable = process.env["SHIPMENT_TABLE_NAME"];

  if (!orderTable || !shipmentTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasShipmentTable: !!shipmentTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 Shipment 資料
    const shipmentResult = await ddb.send(
      new GetItemCommand({
        TableName: shipmentTable,
        Key: marshall({ id: shipmentId }),
      }),
    );

    if (!shipmentResult.Item) {
      logWarn(FUNCTION_NAME, "shipment not found", { shipmentId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的出貨單",
      });
    }

    const shipment = unmarshall(shipmentResult.Item);
    const shipmentStatus = shipment["status"] as string;
    logDebug(FUNCTION_NAME, "shipment loaded", {
      shipmentId,
      status: shipmentStatus,
    });

    // 2. 驗證 Shipment 狀態為 PENDING
    if (shipmentStatus !== "PENDING") {
      logWarn(FUNCTION_NAME, "shipment not in PENDING status", {
        shipmentId,
        status: shipmentStatus,
      });
      return JSON.stringify({
        success: false,
        message: `出貨單狀態為「${shipmentStatus}」，無法追加訂單`,
      });
    }

    // 3. 查詢已關聯此 Shipment 的 Order 數量
    const queryResult = await ddb.send(
      new QueryCommand({
        TableName: orderTable,
        IndexName: "byShipmentId",
        KeyConditionExpression: "shipmentId = :sid",
        ExpressionAttributeValues: marshall({ ":sid": shipmentId }),
        Select: "COUNT",
      }),
    );

    const existingCount = queryResult.Count ?? 0;
    logDebug(FUNCTION_NAME, "existing order count in shipment", {
      shipmentId,
      existingCount,
    });

    // 4. 驗證加入後不超過 50 筆
    const countValidation = validateShipmentOrderCount(existingCount + 1);
    if (!countValidation.valid) {
      logWarn(FUNCTION_NAME, "shipment order count exceeded", {
        shipmentId,
        existingCount,
      });
      return JSON.stringify({
        success: false,
        message: countValidation.error,
      });
    }

    // 5. 取得 Order 資料
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
        message: "找不到指定的訂單",
      });
    }

    const order = unmarshall(orderResult.Item);
    logDebug(FUNCTION_NAME, "order loaded", {
      orderId,
      orderNumber: order["orderNumber"],
      status: order["status"],
      shipmentId: order["shipmentId"],
    });

    // 6. 驗證 Order 狀態為 RECEIVED
    const statusValidation = validateOrdersForShipment([
      order as unknown as import("@shared/models/order").Order,
    ]);
    if (!statusValidation.valid) {
      logWarn(FUNCTION_NAME, "order status validation failed", {
        orderId,
        status: order["status"],
      });
      return JSON.stringify({
        success: false,
        message: statusValidation.error,
      });
    }

    // 7. 驗證 Order 未關聯至未取消的 Shipment
    const orderShipmentId = order["shipmentId"] as string | null;
    if (orderShipmentId) {
      const existingShipmentResult = await ddb.send(
        new GetItemCommand({
          TableName: shipmentTable,
          Key: marshall({ id: orderShipmentId }),
        }),
      );

      const existingShipment = existingShipmentResult.Item
        ? unmarshall(existingShipmentResult.Item)
        : null;

      const activeShipmentValidation = validateOrderNotInActiveShipment(
        {
          orderNumber: order["orderNumber"] as string,
          shipmentId: orderShipmentId,
        },
        existingShipment
          ? {
              shipmentNumber: existingShipment["shipmentNumber"] as string,
              status: existingShipment["status"] as import("@shared/models/shipment").ShipmentStatus,
            }
          : null,
      );

      if (!activeShipmentValidation.valid) {
        logWarn(FUNCTION_NAME, "order already in active shipment", {
          orderId,
          existingShipmentId: orderShipmentId,
        });
        return JSON.stringify({
          success: false,
          message: activeShipmentValidation.error,
        });
      }
    }

    // 8. 更新 Order：設定 shipmentId 與 updatedAt
    const now = new Date().toISOString();

    logDebug(FUNCTION_NAME, "updating order shipmentId", {
      orderId,
      shipmentId,
    });

    await ddb.send(
      new UpdateItemCommand({
        TableName: orderTable,
        Key: marshall({ id: orderId }),
        UpdateExpression:
          "SET shipmentId = :shipmentId, updatedAt = :now",
        ConditionExpression:
          "attribute_not_exists(shipmentId) OR shipmentId = :null OR shipmentId = :currentShipmentId",
        ExpressionAttributeValues: marshall({
          ":shipmentId": shipmentId,
          ":now": now,
          ":null": null,
          ":currentShipmentId": orderShipmentId ?? null,
        }),
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      shipmentId,
    });

    return JSON.stringify({
      success: true,
      message: "訂單已加入出貨單",
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };

    if (err.name === "ConditionalCheckFailedException") {
      logWarn(FUNCTION_NAME, "conditional check failed", {
        orderId,
        shipmentId,
      });
      return JSON.stringify({
        success: false,
        message: "操作失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderId, shipmentId });
    return JSON.stringify({
      success: false,
      message: `追加訂單至出貨單失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
