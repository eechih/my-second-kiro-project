import type { Schema } from "../../data/resource";

/**
 * 訂單分拆操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 建立多筆新 Orders
 * - 依分配方式將 LineItems 的 orderId 更新至對應的新 Order
 * - 將原 Order 狀態變更為 cancelled
 *
 * 包含驗證邏輯：
 * - 原訂單狀態為 pending 或 confirmed
 * - 所有 LineItems 皆有分配目標
 * - 分拆後所有新訂單的明細項目總和等於原訂單（數量守恆）
 */
export const handler: Schema["splitOrder"]["functionHandler"] = async (
  event,
) => {
  // TODO: 在任務 6.4 中實作完整邏輯
  const { orderId, allocations } = event.arguments;
  console.log("splitOrder called:", { orderId, allocations });
  return JSON.stringify({ success: false, message: "Not implemented yet" });
};
