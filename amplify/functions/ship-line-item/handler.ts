import type { Schema } from "../../data/resource";

/**
 * 出貨操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 扣減 ProductVariant（或 Product）的 stockQuantity
 * - 更新 LineItem 的 shippedQuantity 與狀態為「已出貨」
 * - 條件性更新 Order 狀態（任一明細已出貨 → shipping，全部已出貨 → completed）
 *
 * 包含驗證邏輯：
 * - 出貨數量不超過未出貨餘額
 * - 庫存數量充足（使用 ConditionExpression 檢查庫存充足且 version 值一致）
 * - 庫存更新成功後自動遞增 version 欄位
 */
export const handler: Schema["shipLineItem"]["functionHandler"] = async (
  event,
) => {
  // TODO: 在任務 6.4 中實作完整邏輯
  const { orderId, lineItemId, quantity } = event.arguments;
  console.log("shipLineItem called:", { orderId, lineItemId, quantity });
  return JSON.stringify({ success: false, message: "Not implemented yet" });
};
