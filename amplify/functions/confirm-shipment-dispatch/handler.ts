import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
  BatchGetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidShipmentStatusTransition } from "@shared/logic/shipment-status";
import { validateShipmentInventory } from "@shared/logic/shipment-validation";
import {
  logDebug,
  logError,
  logInfo,
  logWarn,
  getTransactionCancellationReasons,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmShipmentDispatch";

/**
 * 確認出貨（含庫存驗證與扣減）Lambda 函式
 *
 * 在單一 DynamoDB TransactWriteItems 中完成：
 * 1. 庫存驗證
 * 2. 庫存扣減
 * 3. Shipment 狀態更新為 SHIPPED
 * 4. 所有關聯 Order 狀態更新為 SHIPPED（含 shippedAt）
 *
 * 需求：5.2, 5.3, 5.9, 7.1, 7.2, 7.3, 7.5
 */
export const handler: Schema["confirmShipmentDispatch"]["functionHandler"] =
  async (event) => {
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
      logDebug(FUNCTION_NAME, "shipment loaded", {
        shipmentId,
        currentStatus,
      });

      // 2. 驗證 Shipment 狀態轉換合法性（PENDING → SHIPPED）
      if (
        !isValidShipmentStatusTransition(
          currentStatus as "PENDING" | "SHIPPED" | "DELIVERED" | "CANCELLED",
          "SHIPPED",
        )
      ) {
        logWarn(FUNCTION_NAME, "invalid shipment status transition", {
          shipmentId,
          currentStatus,
          targetStatus: "SHIPPED",
        });
        return JSON.stringify({
          success: false,
          message: `無法從狀態「${currentStatus}」轉換為「SHIPPED」`,
        });
      }

      // 3. 查詢 Shipment 下的所有 Orders（透過 byShipmentId GSI）
      const orders: Record<string, unknown>[] = [];
      let exclusiveStartKey: Record<string, unknown> | undefined;

      do {
        const queryResult = await ddb.send(
          new QueryCommand({
            TableName: orderTable,
            IndexName: "byShipmentId",
            KeyConditionExpression: "shipmentId = :sid",
            ExpressionAttributeValues: marshall({ ":sid": shipmentId }),
            ...(exclusiveStartKey && {
              ExclusiveStartKey: marshall(exclusiveStartKey),
            }),
          }),
        );

        if (queryResult.Items) {
          for (const item of queryResult.Items) {
            orders.push(unmarshall(item));
          }
        }

        exclusiveStartKey = queryResult.LastEvaluatedKey
          ? unmarshall(queryResult.LastEvaluatedKey)
          : undefined;
      } while (exclusiveStartKey);

      logDebug(FUNCTION_NAME, "orders loaded from GSI", {
        shipmentId,
        orderCount: orders.length,
      });

      if (orders.length === 0) {
        logWarn(FUNCTION_NAME, "no orders found for shipment", { shipmentId });
        return JSON.stringify({
          success: false,
          message: "此出貨單沒有關聯的訂單",
        });
      }

      // 4. 收集所有不重複的 productId，批次取得 Product 庫存
      const uniqueProductIds = [
        ...new Set(orders.map((o) => o["productId"] as string)),
      ];

      const products: Record<string, unknown>[] = [];

      // BatchGetItem 每次最多 100 個 key
      for (let i = 0; i < uniqueProductIds.length; i += 100) {
        const batch = uniqueProductIds.slice(i, i + 100);
        const batchResult = await ddb.send(
          new BatchGetItemCommand({
            RequestItems: {
              [productTable]: {
                Keys: batch.map((pid) => marshall({ id: pid })),
              },
            },
          }),
        );

        if (batchResult.Responses?.[productTable]) {
          for (const item of batchResult.Responses[productTable]) {
            products.push(unmarshall(item));
          }
        }
      }

      logDebug(FUNCTION_NAME, "products loaded", {
        shipmentId,
        productCount: products.length,
      });

      // 5. 使用共用邏輯驗證庫存
      const inventoryValidation = validateShipmentInventory(
        orders.map((o) => ({
          productId: o["productId"] as string,
          productNameSnapshot: o["productNameSnapshot"] as string,
          quantity: o["quantity"] as number,
        })),
        products.map((p) => ({
          id: p["id"] as string,
          stockQuantity: p["stockQuantity"] as number,
        })),
      );

      if (!inventoryValidation.valid) {
        logWarn(FUNCTION_NAME, "inventory validation failed", {
          shipmentId,
          error: inventoryValidation.error,
        });
        return JSON.stringify({
          success: false,
          message: inventoryValidation.error,
        });
      }

      // 6. 彙總各 productId 的出貨數量
      const quantityByProduct = new Map<string, number>();
      for (const order of orders) {
        const productId = order["productId"] as string;
        const quantity = order["quantity"] as number;
        quantityByProduct.set(
          productId,
          (quantityByProduct.get(productId) ?? 0) + quantity,
        );
      }

      const now = new Date().toISOString();

      // 7. 建立 TransactWriteItems
      const transactItems: NonNullable<
        ConstructorParameters<typeof TransactWriteItemsCommand>[0]
      >["TransactItems"] = [];

      // 7a. 更新 Shipment：status → SHIPPED, shippedAt, updatedAt
      transactItems.push({
        Update: {
          TableName: shipmentTable,
          Key: marshall({ id: shipmentId }),
          UpdateExpression:
            "SET #st = :newStatus, shippedAt = :now, updatedAt = :now",
          ConditionExpression: "#st = :expectedStatus",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":newStatus": "SHIPPED",
            ":expectedStatus": "PENDING",
            ":now": now,
          }),
        },
      });

      // 7b. 扣減各 Product 庫存
      for (const [productId, aggregatedQuantity] of quantityByProduct) {
        transactItems.push({
          Update: {
            TableName: productTable,
            Key: marshall({ id: productId }),
            UpdateExpression:
              "SET stockQuantity = stockQuantity - :qty, updatedAt = :now",
            ConditionExpression: "stockQuantity >= :qty",
            ExpressionAttributeValues: marshall({
              ":qty": aggregatedQuantity,
              ":now": now,
            }),
          },
        });
      }

      // 7c. 更新所有 Order：status → SHIPPED, shippedAt, updatedAt, statusHistory
      for (const order of orders) {
        const orderId = order["id"] as string;
        const orderCurrentStatus = order["status"] as string;

        const existingHistory = Array.isArray(order["statusHistory"])
          ? (order["statusHistory"] as Record<string, unknown>[])
          : [];
        const updatedHistory = [
          ...existingHistory,
          {
            fromStatus: orderCurrentStatus,
            toStatus: "SHIPPED",
            changedAt: now,
          },
        ];

        transactItems.push({
          Update: {
            TableName: orderTable,
            Key: marshall({ id: orderId }),
            UpdateExpression:
              "SET #st = :newStatus, shippedAt = :now, statusHistory = :history, updatedAt = :now",
            ConditionExpression: "#st = :expectedStatus",
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: marshall({
              ":newStatus": "SHIPPED",
              ":expectedStatus": "RECEIVED",
              ":now": now,
              ":history": updatedHistory,
            }),
          },
        });
      }

      logDebug(FUNCTION_NAME, "executing transaction", {
        shipmentId,
        transactItemCount: transactItems.length,
        orderCount: orders.length,
        productCount: quantityByProduct.size,
      });

      // 8. 執行交易
      await ddb.send(
        new TransactWriteItemsCommand({
          TransactItems: transactItems,
        }),
      );

      logInfo(FUNCTION_NAME, "handler succeeded", {
        shipmentId,
        orderCount: orders.length,
        productCount: quantityByProduct.size,
        status: "SHIPPED",
        shippedAt: now,
      });

      return JSON.stringify({
        success: true,
        message: "出貨確認成功",
        data: {
          shipmentId,
          status: "SHIPPED",
          shippedAt: now,
          orderCount: orders.length,
          orderIds: orders.map((o) => o["id"] as string),
        },
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
        message: `出貨確認失敗：${err.message ?? "未知錯誤"}`,
      });
    }
  };
