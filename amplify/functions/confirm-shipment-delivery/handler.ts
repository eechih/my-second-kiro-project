import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidShipmentStatusTransition } from "@shared/logic/shipment-status";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmShipmentDelivery";

/**
 * 確認送達 Lambda 函式
 *
 * 將 Shipment 狀態從 SHIPPED 轉換為 DELIVERED，
 * 同時將所有關聯 Order 的狀態更新為 COMPLETED。
 *
 * 需求：5.4, 5.5
 */
export const handler: Schema["confirmShipmentDelivery"]["functionHandler"] =
  async (event) => {
    const { shipmentId } = event.arguments;
    logInfo(FUNCTION_NAME, "handler started", { shipmentId });

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
      // 1. 讀取 Shipment 資料
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
      const currentStatus = shipment["status"] as string;

      logDebug(FUNCTION_NAME, "shipment loaded", {
        shipmentId,
        currentStatus,
      });

      // 2. 驗證 Shipment 狀態轉換是否合法（SHIPPED → DELIVERED）
      if (!isValidShipmentStatusTransition(currentStatus as "PENDING" | "SHIPPED" | "DELIVERED" | "CANCELLED", "DELIVERED")) {
        logWarn(FUNCTION_NAME, "invalid shipment status transition", {
          shipmentId,
          currentStatus,
          targetStatus: "DELIVERED",
        });
        return JSON.stringify({
          success: false,
          message: `無法從狀態「${currentStatus}」轉換為「DELIVERED」`,
        });
      }

      // 3. 查詢所有關聯 Order（使用 byShipmentId GSI）
      const ordersResult = await ddb.send(
        new QueryCommand({
          TableName: orderTable,
          IndexName: "byShipmentId",
          KeyConditionExpression: "shipmentId = :sid",
          ExpressionAttributeValues: marshall({ ":sid": shipmentId }),
        }),
      );

      const orders = (ordersResult.Items ?? []).map((item) => unmarshall(item));

      logDebug(FUNCTION_NAME, "orders loaded", {
        shipmentId,
        orderCount: orders.length,
      });

      // 4. 建立交易
      const now = new Date().toISOString();

      const transactItems: NonNullable<
        ConstructorParameters<typeof TransactWriteItemsCommand>[0]
      >["TransactItems"] = [];

      // 4a. 更新 Shipment：status → DELIVERED, deliveredAt, updatedAt
      transactItems.push({
        Update: {
          TableName: shipmentTable,
          Key: marshall({ id: shipmentId }),
          UpdateExpression:
            "SET #st = :newStatus, deliveredAt = :now, updatedAt = :now",
          ConditionExpression: "#st = :expectedStatus",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":newStatus": "DELIVERED",
            ":expectedStatus": "SHIPPED",
            ":now": now,
          }),
        },
      });

      // 4b. 更新每筆 Order：status → COMPLETED, completedAt, statusHistory, updatedAt
      for (const order of orders) {
        const orderId = order["id"] as string;
        const existingHistory = Array.isArray(order["statusHistory"])
          ? (order["statusHistory"] as Record<string, unknown>[])
          : [];
        const updatedHistory = [
          ...existingHistory,
          {
            fromStatus: "SHIPPED",
            toStatus: "COMPLETED",
            changedAt: now,
          },
        ];

        transactItems.push({
          Update: {
            TableName: orderTable,
            Key: marshall({ id: orderId }),
            UpdateExpression:
              "SET #st = :newStatus, completedAt = :now, updatedAt = :now, statusHistory = :history",
            ConditionExpression: "#st = :expectedStatus",
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: marshall({
              ":newStatus": "COMPLETED",
              ":expectedStatus": "SHIPPED",
              ":now": now,
              ":history": updatedHistory,
            }),
          },
        });
      }

      // 5. 執行交易
      logDebug(FUNCTION_NAME, "executing transaction", {
        shipmentId,
        orderCount: orders.length,
        transactItemCount: transactItems.length,
      });

      await ddb.send(
        new TransactWriteItemsCommand({ TransactItems: transactItems }),
      );

      logInfo(FUNCTION_NAME, "handler succeeded", {
        shipmentId,
        orderCount: orders.length,
        shipmentStatus: "DELIVERED",
      });

      return JSON.stringify({
        success: true,
        message: "確認送達成功",
      });
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      if (err.name === "TransactionCanceledException") {
        logWarn(FUNCTION_NAME, "transaction cancelled", {
          shipmentId,
          cancellationReasons: getTransactionCancellationReasons(error),
        });
        return JSON.stringify({
          success: false,
          message: "資料已被其他操作變更，請重新取得最新資料後重試",
        });
      }

      logError(FUNCTION_NAME, "handler failed", error, { shipmentId });
      return JSON.stringify({
        success: false,
        message: `確認送達失敗：${err.message ?? "未知錯誤"}`,
      });
    }
  };
