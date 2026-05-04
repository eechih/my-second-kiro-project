/**
 * 訂單金額計算
 *
 * 提供明細項目小計與訂單總金額的計算函式。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：4.11
 */

import type { LineItem } from "../models/order";

/**
 * 計算單筆明細項目的小計金額。
 *
 * 小計 = 數量 × 單價
 *
 * @param quantity - 訂購數量（應 > 0）
 * @param unitPrice - 單價（應 >= 0）
 * @returns 小計金額（quantity × unitPrice）
 */
export function calculateLineItemSubtotal(
  quantity: number,
  unitPrice: number,
): number {
  return quantity * unitPrice;
}

/**
 * 計算訂單的總金額。
 *
 * 總金額 = 所有明細項目小計（quantity × unitPrice）的加總。
 * 使用每筆明細的 quantity 與 unitPrice 重新計算，而非直接加總 subtotal 欄位，
 * 確保計算結果的正確性不依賴於 subtotal 是否已正確設定。
 *
 * @param lineItems - 明細項目列表
 * @returns 訂單總金額
 */
export function calculateOrderTotal(lineItems: LineItem[]): number {
  return lineItems.reduce(
    (total, item) =>
      total + calculateLineItemSubtotal(item.quantity, item.unitPrice),
    0,
  );
}
