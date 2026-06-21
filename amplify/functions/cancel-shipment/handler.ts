import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { OrderFulfillmentStatus } from "@shared/models/order";
import { isOrderFulfillmentStatus } from "@shared/models/order";
import type { Schema } from "../../data/resource";
import {
  getTransactionCancellationReasons,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../debug-log";

const ddb = new DynamoDBClient({});
const FUNCTION_NAME = "cancelShipment";

/**
 * 取消出貨 Lambda 函式
 *
 * 接受 orderId，驗證 Order 狀態為 SHIPPED，
 * 在 DynamoDB 交易中將 Order 狀態回退為 RECEIVED 並恢復商品庫存。
 */
export const handler: Schema["cancelShipment"]["functionHandler"] = async (
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
    // 1. 讀取 Order 資料
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
    const currentStatus = order["status"] as string;
    const quantity = order["quantity"] as number;
    const productId = order["productId"] as string;

    logDebug(FUNCTION_NAME, "order loaded", {
      orderId,
      currentStatus,
      quantity,
      productId,
    });

    // 2. 驗證 Order 狀態為 SHIPPED（只有已出貨才能取消出貨）
    if (!isOrderFulfillmentStatus(currentStatus)) {
      logWarn(FUNCTION_NAME, "invalid order status", {
        orderId,
        currentStatus,
      });
      return JSON.stringify({
        success: false,
        message: `訂單狀態無效：「${currentStatus}」`,
      });
    }

    if ((currentStatus as OrderFulfillmentStatus) !== "SHIPPED") {
      logWarn(FUNCTION_NAME, "order not in shipped status", {
        orderId,
        currentStatus,
      });
      return JSON.stringify({
        success: false,
        message: `僅已出貨的訂單可取消出貨，目前狀態為「${currentStatus}」`,
      });
    }

    // 3. 讀取 Product 資料
    const productResult = await ddb.send(
      new GetItemCommand({
        TableName: productTable,
        Key: marshall({ id: productId }),
      }),
    );

    if (!productResult.Item) {
      logWarn(FUNCTION_NAME, "product not found", { orderId, productId });
      return JSON.stringify({
        success: false,
        message: "找不到指定的商品",
      });
    }

    logDebug(FUNCTION_NAME, "product loaded", {
      orderId,
      productId,
    });

    // 4. 建立交易：回退 Order 狀態 + 恢復 Product 庫存
    const now = new Date().toISOString();
    const existingHistory =
      (order["statusHistory"] as Record<string, unknown>[]) ?? [];
    const newHistoryEntry = {
      fromStatus: "SHIPPED",
      toStatus: "RECEIVED",
      changedAt: now,
    };
    const updatedHistory = [...existingHistory, newHistoryEntry];

    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteItemsCommand>[0]
    >["TransactItems"] = [];

    // 4a. 更新 Order：status → RECEIVED, REMOVE shippedAt, 更新 statusHistory
    transactItems.push({
      Update: {
        TableName: orderTable,
        Key: marshall({ id: orderId }),
        UpdateExpression:
          "SET #st = :newStatus, statusHistory = :history, updatedAt = :now REMOVE shippedAt",
        ConditionExpression: "#st = :shipped",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":newStatus": "RECEIVED",
          ":shipped": "SHIPPED",
          ":now": now,
          ":history": updatedHistory,
        }),
      },
    });

    // 4b. 恢復 Product 庫存
    transactItems.push({
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
    });

    // 5. 執行交易
    logDebug(FUNCTION_NAME, "executing transaction", {
      orderId,
      productId,
      quantity,
      transactItemCount: transactItems.length,
    });

    await ddb.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems }),
    );

    logInfo(FUNCTION_NAME, "handler succeeded", {
      orderId,
      productId,
      restoredQuantity: quantity,
      orderStatus: "RECEIVED",
    });

    return JSON.stringify({
      success: true,
      message: "取消出貨成功",
      data: {
        orderId,
        productId,
        restoredQuantity: quantity,
        orderStatus: "RECEIVED",
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
        message: "取消出貨失敗，資料已變更，請重新取得最新資料後重試",
      });
    }
    logError(FUNCTION_NAME, "handler failed", error, { orderId });
    return JSON.stringify({
      success: false,
      message: `取消出貨失敗：${err.message ?? "未知錯誤"}`,
    });
  }
};
