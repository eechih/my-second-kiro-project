import type { Schema } from "../../data/resource";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { isValidOrderStatusTransition } from "@shared/logic/order-status";
import type { OrderFulfillmentStatus } from "@shared/models/order";
import { isOrderFulfillmentStatus } from "@shared/models/order";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "confirmReceived";

/**
 * 入庫確認 Lambda 函式
 *
 * 將 Order 的 status 從 ORDERED 轉換為 RECEIVED，
 * 記錄 receivedAt，附加 statusHistory 記錄，
 * 並在同一交易中增加 Product 的 stockQuantity。
 *
 * 需求：2.5, 3.3, 3.9
 */
export const handler: Schema["confirmReceived"]["functionHandler"] = async (
  event,
) => {
  const { orderId } = event.arguments;
  logInfo(FUNCTION_NAME, "handler started", { orderId });

  const orderTable = process.env["ORDER_TABLE_NAME"];
  const productTable = process.env["PRODUCT_TABLE_NAME"];

  if (!orderTable || !productTable) {
    logWarn(FUNCTION_NAME, "missing environment variables", {
      hasOrderTable: !!orderTable,
      hasProductTable: !!productTable,
    });
    return JSON.stringify({
      success: false,
      message: "缺少必要的環境變數設定",
    });
  }

  try {
    // 1. 取得 Order 資料
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
    const rawStatus = order["status"];
    const productId = order["productId"] as string;
    const quantity = order["quantity"] as number;
    logDebug(FUNCTION_NAME, "order loaded", {
      orderId,
      rawStatus,
      productId,
      quantity,
    });

    if (!productId) {
      return JSON.stringify({
        success: false,
        message: "訂單缺少商品關聯",
      });
    }

    // 2. 驗證目前狀態是否為合法的 OrderFulfillmentStatus
    if (!isOrderFulfillmentStatus(rawStatus)) {
      logWarn(FUNCTION_NAME, "invalid order status", { orderId, rawStatus });
      return JSON.stringify({
        success: false,
        message: "訂單狀態無法識別，無法確認入庫",
      });
    }

    const currentStatus: OrderFulfillmentStatus = rawStatus;
    const targetStatus: OrderFulfillmentStatus = "RECEIVED";

    // 3. 使用共用邏輯驗證狀態轉換合法性（ORDERED → RECEIVED）
    if (!isValidOrderStatusTransition(currentStatus, targetStatus)) {
      logWarn(FUNCTION_NAME, "invalid status transition", {
        orderId,
        currentStatus,
        targetStatus,
      });
      return JSON.stringify({
        success: false,
        message: `無法從「${currentStatus}」狀態確認入庫，僅「ORDERED」狀態可確認入庫`,
      });
    }

    const now = new Date().toISOString();

    // 4. 建立 statusHistory 記錄
    const existingHistory = Array.isArray(order["statusHistory"])
      ? (order["statusHistory"] as Record<string, unknown>[])
      : [];
    const updatedHistory = [
      ...existingHistory,
      {
        fromStatus: currentStatus,
        toStatus: targetStatus,
        changedAt: now,
      },
    ];

    // 5. 執行交易：更新 Order 狀態 + 增加 Product 庫存
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      productId,
      quantity,
      currentStatus,
      targetStatus,
    });

    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          // 5a. 更新 Order：status → RECEIVED、receivedAt、statusHistory
          {
            Update: {
              TableName: orderTable,
              Key: marshall({ id: orderId }),
              UpdateExpression:
                "SET #st = :newStatus, receivedAt = :now, statusHistory = :history, updatedAt = :now",
              ConditionExpression: "#st = :expectedStatus",
              ExpressionAttributeNames: { "#st": "status" },
              ExpressionAttributeValues: marshall({
                ":newStatus": targetStatus,
                ":expectedStatus": currentStatus,
                ":now": now,
                ":history": updatedHistory,
              }),
            },
          },
          // 5b. 增加 Product 庫存
          {
            Update: {
              TableName: productTable,
              Key: marshall({ id: productId }),
              UpdateExpression:
                "SET stockQuantity = stockQuantity + :qty, updatedAt = :now",
              ConditionExpression: "attribute_exists(id)",
              ExpressionAttributeValues: marshall({
                ":qty": quantity,
                ":now": now,
              }),
            },
          },
        ],
      }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      productId,
      quantity,
      status: targetStatus,
      receivedAt: now,
    });

    return JSON.stringify({
      success: true,
      message: "入庫確認成功",
      data: {
        orderId,
        productId,
        quantity,
        status: targetStatus,
        receivedAt: now,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "TransactionCanceledException") {
      logWarn(FUNCTION_NAME, "transaction cancelled", {
        orderId,
        cancellationReasons: getTransactionCancellationReasons(error),
      });
      return JSON.stringify({
        success: false,
        message: "入庫確認失敗，資料已變更，請重新取得最新資料後重試",
      });
    }

    logError(FUNCTION_NAME, "handler failed", error, { orderId });
    return JSON.stringify({
      success: false,
      message: `入庫確認失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
