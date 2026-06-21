import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { logDebug, logError, logInfo, logWarn } from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "removeOrderFromShipment";

/**
 * 從出貨單移除訂單 Lambda 函式
 *
 * 驗證 Shipment 狀態為 PENDING，然後清除 Order.shipmentId。
 *
 * 需求：6.6, 6.7
 */
export const handler: Schema["removeOrderFromShipment"]["functionHandler"] =
  async (event) => {
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
        logWarn(FUNCTION_NAME, "shipment status not PENDING", {
          shipmentId,
          status: shipmentStatus,
        });
        return JSON.stringify({
          success: false,
          message: `出貨單狀態為「${shipmentStatus}」，無法移除訂單`,
        });
      }

      // 3. 取得 Order 資料
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
      const orderShipmentId = order["shipmentId"] as string | null | undefined;
      logDebug(FUNCTION_NAME, "order loaded", {
        orderId,
        orderShipmentId,
      });

      // 4. 驗證 Order 確實關聯至此 Shipment
      if (orderShipmentId !== shipmentId) {
        logWarn(FUNCTION_NAME, "order not associated with shipment", {
          orderId,
          shipmentId,
          orderShipmentId,
        });
        return JSON.stringify({
          success: false,
          message: "此訂單未關聯至此出貨單",
        });
      }

      const now = new Date().toISOString();

      // 5. 清除 Order 的 shipmentId（使用 REMOVE），更新 updatedAt
      logDebug(FUNCTION_NAME, "clearing order shipmentId", {
        orderId,
        shipmentId,
      });

      await ddb.send(
        new UpdateItemCommand({
          TableName: orderTable,
          Key: marshall({ id: orderId }),
          UpdateExpression: "REMOVE shipmentId SET updatedAt = :now",
          ConditionExpression: "shipmentId = :expectedShipmentId",
          ExpressionAttributeValues: marshall({
            ":now": now,
            ":expectedShipmentId": shipmentId,
          }),
        }),
      );

      logInfo(FUNCTION_NAME, "handler succeeded", {
        orderId,
        shipmentId,
      });

      return JSON.stringify({
        success: true,
        message: "已從出貨單移除訂單",
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

      logError(FUNCTION_NAME, "handler failed", error, {
        orderId,
        shipmentId,
      });
      return JSON.stringify({
        success: false,
        message: `移除訂單失敗：${err.message ?? "未知錯誤"}`,
      });
    }
  };
