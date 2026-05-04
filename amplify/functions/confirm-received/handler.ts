import type { Schema } from "../../data/resource";

/**
 * 入庫確認操作 Lambda 函式
 *
 * 使用 DynamoDB TransactWriteItems 在單一交易中執行：
 * - 增加 ProductVariant（或 Product）的 stockQuantity
 * - 更新 PurchaseRecord 狀態為 received 並記錄 receivedAt
 * - 更新 LineItem 狀態為「已收到」並記錄 receivedAt
 *
 * 包含驗證邏輯：
 * - PurchaseRecord 狀態必須為 pending（已入庫記錄不可重複確認）
 * - 庫存更新使用 ConditionExpression 檢查 version 值一致
 * - 庫存更新成功後自動遞增 version 欄位
 */
export const handler: Schema["confirmReceived"]["functionHandler"] = async (
  event,
) => {
  // TODO: 在任務 6.4 中實作完整邏輯
  const { purchaseRecordId } = event.arguments;
  console.log("confirmReceived called:", { purchaseRecordId });
  return JSON.stringify({ success: false, message: "Not implemented yet" });
};
