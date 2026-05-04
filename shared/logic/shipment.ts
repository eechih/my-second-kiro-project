/**
 * 出貨數量與庫存驗證
 *
 * 提供出貨操作的數量驗證與庫存解析函式。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：7.2, 7.3, 7.4, 7.5
 */

import type { ValidationResult } from "../models/order";
import type { Product } from "../models/product";

/**
 * 計算明細項目的未出貨餘額。
 *
 * @param orderQuantity - 訂單數量（明細項目的訂購數量）
 * @param shippedQuantity - 累計已出貨數量
 * @returns 未出貨餘額（orderQuantity - shippedQuantity）
 */
export function calculateRemainingShipQuantity(
  orderQuantity: number,
  shippedQuantity: number,
): number {
  return orderQuantity - shippedQuantity;
}

/**
 * 驗證出貨操作是否合法。
 *
 * 同時檢查兩個條件：
 * (a) 出貨數量不超過未出貨餘額（訂單數量減去累計已出貨數量）
 * (b) 出貨數量不超過該規格組合（或無規格商品）的目前庫存數量
 *
 * @param requestedQty - 本次請求的出貨數量
 * @param remainingShipQty - 未出貨餘額（可透過 calculateRemainingShipQuantity 計算）
 * @param stockQuantity - 目前庫存數量（規格組合層級或商品層級）
 * @returns 驗證結果
 */
export function validateShipment(
  requestedQty: number,
  remainingShipQty: number,
  stockQuantity: number,
): ValidationResult {
  if (requestedQty <= 0) {
    return { valid: false, error: "出貨數量必須大於 0" };
  }

  if (requestedQty > remainingShipQty) {
    return {
      valid: false,
      error: `出貨數量（${requestedQty}）超過未出貨餘額（${remainingShipQty}）`,
    };
  }

  if (requestedQty > stockQuantity) {
    return {
      valid: false,
      error: `出貨數量（${requestedQty}）超過目前庫存數量（${stockQuantity}）`,
    };
  }

  return { valid: true };
}

/**
 * 解析庫存數量：依據 variantId 決定回傳規格組合層級或商品層級的庫存。
 *
 * - 若 variantId 不為 null，在商品的 variants 中尋找對應的規格組合，回傳其 stockQuantity。
 * - 若 variantId 為 null，回傳商品的 stockQuantity。
 * - 若 variantId 不為 null 但找不到對應的規格組合，回傳 0（防禦性處理）。
 *
 * @param product - 商品物件（含 variants 列表）
 * @param variantId - 規格組合 ID（無規格組合時為 null）
 * @returns 對應層級的庫存數量
 */
export function resolveStockQuantity(
  product: Product,
  variantId: string | null,
): number {
  if (variantId === null) {
    return product.stockQuantity;
  }

  const variant = product.variants.find((v) => v.id === variantId);
  return variant?.stockQuantity ?? 0;
}
