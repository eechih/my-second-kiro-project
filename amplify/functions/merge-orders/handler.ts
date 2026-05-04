import type { Schema } from "../../data/resource";

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
  // TODO: 在任務 6.4 中實作完整邏輯
  const { orderIds } = event.arguments;
  console.log("mergeOrders called:", { orderIds });
  return JSON.stringify({ success: false, message: "Not implemented yet" });
};
