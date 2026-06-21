import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "cancelShipmentOrder";

/**
 * 取消出貨單 Lambda 函式
 *
 * 將 PENDING 狀態的 Shipment 轉為 CANCELLED，回退 Orders 狀態為 RECEIVED 並清除 shipmentId。
 * 若 Shipment 為 SHIPPED 狀態則額外回補庫存。
 *
 * 需求：5.6, 5.7, 5.9, 7.4
 */
export const handler: Schema["cancelShipmentOrder"]["functionHandler"] = async (
  event,
) => {
  const { shipmentId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { shipmentId });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];
  const shipmentTable = process.env["SHIPMENT_TABLE_NAME"];

  if (!orderTable || !productTable || !shipmentTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasProductTable: !!productTable,
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
    const currentStatus = shipment["status"] as string;
    logDebug(FUNCTION_NAME, "shipment loaded", { shipmentId, currentStatus });

    // 2. 驗證狀態允許取消：PENDING 或 SHIPPED
    if (currentStatus !== "PENDING" && currentStatus !== "SHIPPED") {
      logWarn(FUNCTION_NAME, "invalid status for cancellation", {
        shipmentId,
        currentStatus,
      });
      return JSON.stringify({
        success: false,
        message: `無法從狀態「${currentStatus}」取消出貨單`,
      });
    }

    // 3. 查詢所有關聯的 Orders（透過 byShipmentId GSI）
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

    const now = new Date().toISOString();

    // 4. 建立交易項目
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 4a. 更新 Shipment：status → CANCELLED
    transactItems.push({
      Update: {
        TableName: shipmentTable,
        Key: marshall({ id: shipmentId }),
        UpdateExpression:
          "SET #st = :cancelled, cancelledAt = :now, updatedAt = :now",
        ConditionExpression: "#st = :expectedStatus",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":cancelled": "CANCELLED",
          ":expectedStatus": currentStatus,
          ":now": now,
        }),
      },
    });

    // 4b. 更新每筆 Order
    for (const order of orders) {
      const orderId = order["id"] as string;
      const orderStatus = order["status"] as string;
      const existingHistory = Array.isArray(order["statusHistory"])
        ? (order["statusHistory"] as Record<string, unknown>[])
        : [];

      if (currentStatus === "PENDING") {
        // PENDING 出貨單取消：回退 Order 狀態為 RECEIVED，清除 shipmentId
        const updatedHistory = [
          ...existingHistory,
          {
            fromStatus: orderStatus,
            toStatus: "RECEIVED",
            changedAt: now,
          },
        ];

        transactItems.push({
          Update: {
            TableName: orderTable,
            Key: marshall({ id: orderId }),
            UpdateExpression:
              "SET #st = :received, shipmentId = :nullVal, statusHistory = :history, updatedAt = :now",
            ConditionExpression: "shipmentId = :shipmentId",
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: marshall({
              ":received": "RECEIVED",
              ":nullVal": null,
              ":shipmentId": shipmentId,
              ":history": updatedHistory,
              ":now": now,
            }),
          },
        });
      } else {
        // SHIPPED 出貨單取消：回退 Order 狀態為 RECEIVED，清除 shipmentId 與 shippedAt
        const updatedHistory = [
          ...existingHistory,
          {
            fromStatus: "SHIPPED",
            toStatus: "RECEIVED",
            changedAt: now,
          },
        ];

        transactItems.push({
          Update: {
            TableName: orderTable,
            Key: marshall({ id: orderId }),
            UpdateExpression:
              "SET #st = :received, shipmentId = :nullVal, shippedAt = :nullVal, statusHistory = :history, updatedAt = :now",
            ConditionExpression:
              "#st = :shipped AND shipmentId = :shipmentId",
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: marshall({
              ":received": "RECEIVED",
              ":nullVal": null,
              ":shipped": "SHIPPED",
              ":shipmentId": shipmentId,
              ":history": updatedHistory,
              ":now": now,
            }),
          },
        });
      }
    }

    // 4c. 若 Shipment 為 SHIPPED，回補庫存
    if (currentStatus === "SHIPPED") {
      // 彙總各 productId 的數量
      const quantityByProduct = new Map<string, number>();
      for (const order of orders) {
        const productId = order["productId"] as string;
        const quantity = order["quantity"] as number;
        if (productId && quantity) {
          const existing = quantityByProduct.get(productId) ?? 0;
          quantityByProduct.set(productId, existing + quantity);
        }
      }

      for (const [productId, totalQuantity] of quantityByProduct) {
        transactItems.push({
          Update: {
            TableName: productTable,
            Key: marshall({ id: productId }),
            UpdateExpression:
              "SET stockQuantity = stockQuantity + :qty, updatedAt = :now",
            ConditionExpression: "attribute_exists(id)",
            ExpressionAttributeValues: marshall({
              ":qty": totalQuantity,
              ":now": now,
            }),
          },
        });
      }

      logDebug(FUNCTION_NAME, "stock restoration planned", {
        shipmentId,
        productCount: quantityByProduct.size,
        quantities: Object.fromEntries(quantityByProduct),
      });
    }

    // 5. 處理 TransactWriteItems 上限（最多 100 項）
    if (transactItems.length <= 100) {
      // 單一交易即可完成
      await ddb.send(
        new TransactWriteItemsCommand({
          TransactItems: transactItems,
        }),
      );
    } else {
      // 超過 100 項時拆分：主交易包含 Shipment 更新 + Order 更新，
      // 庫存回補作為獨立交易（犧牲庫存部分的原子性）
      const shipmentAndOrderItems = transactItems.slice(
        0,
        1 + orders.length,
      );
      const stockItems = transactItems.slice(1 + orders.length);

      logWarn(FUNCTION_NAME, "splitting transaction due to item limit", {
        shipmentId,
        totalItems: transactItems.length,
        mainItems: shipmentAndOrderItems.length,
        stockItems: stockItems.length,
      });

      // 先執行主交易（Shipment + Orders）
      await ddb.send(
        new TransactWriteItemsCommand({
          TransactItems: shipmentAndOrderItems,
        }),
      );

      // 再執行庫存回補交易
      if (stockItems.length > 0) {
        await ddb.send(
          new TransactWriteItemsCommand({
            TransactItems: stockItems,
          }),
        );
      }
    }

    logInfo(FUNCTION_NAME, "handler succeeded", {
      shipmentId,
      previousStatus: currentStatus,
      orderCount: orders.length,
    });

    return JSON.stringify({
      success: true,
      message: "取消出貨單成功",
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
      message: `取消出貨單失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
