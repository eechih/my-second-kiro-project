/**
 * 出貨庫存驗證
 *
 * 提供出貨操作的庫存驗證函式。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 * 不支援分批出貨——每次出貨即為明細的全部數量。
 *
 * 需求：7.2, 7.3, 7.4, 7.5
 */

import type { ValidationResult } from "../models/order";
import type { Product } from "../models/product";

/**
 * 驗證出貨操作是否合法。
 *
 * 檢查出貨數量（即明細的 quantity）不超過目前庫存數量。
 *
 * @param quantity - 出貨數量（明細的訂購數量）
 * @param stockQuantity - 目前庫存數量（商品層級）
 * @returns 驗證結果
 */
export function validateShipment(
  quantity: number,
  stockQuantity: number,
): ValidationResult {
  if (quantity <= 0) {
    return { valid: false, error: "出貨數量必須大於 0" };
  }

  if (quantity > stockQuantity) {
    return {
      valid: false,
      error: `出貨數量（${quantity}）超過目前庫存數量（${stockQuantity}）`,
    };
  }

  return { valid: true };
}

/**
 * 解析庫存數量：庫存統一在商品層級管理。
 *
 * @param product - 商品物件
 * @returns 商品層級的庫存數量
 */
export function resolveStockQuantity(product: Product): number {
  return product.stockQuantity;
}
