import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidOrderStatusTransition } from "../../../shared/logic/order-status";
import type { OrderStatus } from "../../../shared/models/order";

const ddb = new DynamoDBClient({});

/** 產生唯一訂單編號（時間戳 + 隨機碼） */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

/** 前端傳入的訂單識別結構 */
interface OrderIdInput {
  customerId: string;
  sortKey: string;
}

/**
 * 訂單合併操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 建立新 Order（包含所有來源訂單的 LineItems）
 * - 搬移所有 LineItems 的 orderId 至新 Order
 * - 將所有來源 Orders 狀態變更為 cancelled
 *
 * 包含驗證邏輯：
 * - 所有來源訂單屬於同一客戶
 * - 狀態皆為 pending 或 confirmed
 * - 合併後新訂單總金額等於所有來源訂單總金額加總
 */
export const handler: Schema["mergeOrders"]["functionHandler"] = async (
  event,
) => {
  const orderIds = event.arguments.orderIds as unknown as OrderIdInput[];

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const lineItemTable = process.env["LINEITEM_TABLE_NAME"];

  if (!orderTable || !lineItemTable) {
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 驗證至少兩筆訂單
    if (!Array.isArray(orderIds) || orderIds.length < 2) {
      return JSON.stringify({
        success: false,
        message: "至少需要選取兩筆訂單才能合併",
      });
    }

    // 2. 取得所有來源訂單資料
    const orders: Record<string, unknown>[] = [];
    for (const oid of orderIds) {
      const result = await ddb.send(
        new GetItemCommand({
          TableName: orderTable,
          Key: marshall({
            customerId: oid.customerId,
            sortKey: oid.sortKey,
          }),
        }),
      );
      if (!result.Item) {
        return JSON.stringify({
          success: false,
          message: `找不到訂單：${oid.customerId}/${oid.sortKey}`,
        });
      }
      orders.push(unmarshall(result.Item));
    }

    // 3. 驗證同一客戶
    const firstCustomerId = orders[0]!["customerId"] as string;
    const hasDifferentCustomer = orders.some(
      (order) => (order["customerId"] as string) !== firstCustomerId,
    );
    if (hasDifferentCustomer) {
      return JSON.stringify({
        success: false,
        message: "僅能合併同一客戶的訂單",
      });
    }

    // 4. 驗證狀態皆為 pending 或 confirmed
    const mergeableStatuses = new Set<string>(["pending", "confirmed"]);
    const invalidOrder = orders.find(
      (order) => !mergeableStatuses.has(order["status"] as string),
    );
    if (invalidOrder) {
      return JSON.stringify({
        success: false,
        message: "僅能合併待處理或已確認的訂單",
      });
    }

    // 5. 取得所有來源訂單的明細項目
    const allLineItems: Record<string, unknown>[] = [];
    for (const order of orders) {
      const customerId = order["customerId"] as string;
      const sortKey = order["sortKey"] as string;

      const lineItemsResult = await ddb.send(
        new QueryCommand({
          TableName: lineItemTable,
          IndexName: "byOrderId",
          KeyConditionExpression: "orderId = :orderId",
          ExpressionAttributeValues: marshall({ ":orderId": customerId }),
        }),
      );

      const items = (lineItemsResult.Items ?? [])
        .map((rawItem) => unmarshall(rawItem))
        .filter(
          (item) => item["orderSortKey"] === sortKey,
        );
      allLineItems.push(...items);
    }

    // 6. 計算合併後總金額
    let totalAmount = 0;
    for (const order of orders) {
      totalAmount += order["totalAmount"] as number;
    }

    const now = new Date().toISOString();
    const newOrderNumber = generateOrderNumber();
    const newSortKey = `ORDER#${now}`;
    const customerName = orders[0]!["customerName"] as string;

    // 7. 建立交易項目（DynamoDB TransactWriteItems 最多 100 個項目）
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 7a. 建立新訂單
    transactItems.push({
      Put: {
        TableName: orderTable,
        Item: marshall({
          customerId: firstCustomerId,
          sortKey: newSortKey,
          orderNumber: newOrderNumber,
          customerName,
          totalAmount,
          status: "pending",
          statusHistory: [
            {
              fromStatus: "created",
              toStatus: "pending",
              changedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        }),
      },
    });

    // 7b. 搬移所有 LineItems 的 orderId 至新 Order
    for (const lineItem of allLineItems) {
      transactItems.push({
        Update: {
          TableName: lineItemTable,
          Key: marshall({ id: lineItem["id"] as string }),
          UpdateExpression:
            "SET orderId = :newOrderId, orderSortKey = :newSortKey, updatedAt = :now",
          ExpressionAttributeValues: marshall({
            ":newOrderId": firstCustomerId,
            ":newSortKey": newSortKey,
            ":now": now,
          }),
        },
      });
    }

    // 7c. 將所有來源 Orders 狀態變更為 cancelled
    for (const order of orders) {
      const currentStatus = order["status"] as OrderStatus;
      if (!isValidOrderStatusTransition(currentStatus, "cancelled")) {
        continue; // 理論上不會發生（已通過驗證）
      }

      const existingHistory =
        (order["statusHistory"] as Record<string, unknown>[]) ?? [];
      const newHistoryEntry = {
        fromStatus: currentStatus,
        toStatus: "cancelled",
        changedAt: now,
      };
      const updatedHistory = [...existingHistory, newHistoryEntry];

      transactItems.push({
        Update: {
          TableName: orderTable,
          Key: marshall({
            customerId: order["customerId"] as string,
            sortKey: order["sortKey"] as string,
          }),
          UpdateExpression:
            "SET #st = :cancelled, statusHistory = :history, updatedAt = :now",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: marshall({
            ":cancelled": "cancelled",
            ":history": updatedHistory,
            ":now": now,
          }),
        },
      });
    }

    // 8. 檢查交易項目數量限制（DynamoDB 最多 100 個）
    if (transactItems.length > 100) {
      return JSON.stringify({
        success: false,
        message: `合併操作涉及 ${String(transactItems.length)} 個項目，超過 DynamoDB 交易限制（100）。請減少合併的訂單數量。`,
      });
    }

    // 9. 執行交易
    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    return JSON.stringify({
      success: true,
      message: "訂單合併成功",
      data: {
        newOrderId: firstCustomerId,
        newOrderSortKey: newSortKey,
        newOrderNumber,
        totalAmount,
        mergedOrderCount: orders.length,
        lineItemCount: allLineItems.length,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      return JSON.stringify({
        success: false,
        message:
          "訂單合併失敗：訂單狀態已變更，請重新取得最新資料後重試",
      });
    }
    console.error("mergeOrders error:", error);
    return JSON.stringify({
      success: false,
      message: `訂單合併失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
