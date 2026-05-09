/**
 * 規格選項（Product Variant）純函式
 *
 * 提供價格/成本解析、必選驗證等函式。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：3.12, 3.13, 3.14, 3.15, 4.12, 4.13
 */

import type { ValidationResult } from "../models/order";
import type { Product, ProductVariant } from "../models/product";

/**
 * 解析規格組合的有效單價。
 *
 * 若 variant.price 不為 null，回傳覆寫值；
 * 否則回傳 product.unitPrice。
 *
 * @param variant - 規格組合
 * @param product - 商品
 * @returns 有效單價
 */
export function resolveEffectivePrice(
  variant: ProductVariant,
  product: Product,
): number {
  return variant.price !== null
    ? variant.price
    : product.unitPrice;
}

/**
 * 解析規格組合的有效進貨成本。
 *
 * 若 variant.cost 不為 null，回傳覆寫值；
 * 否則回傳 product.defaultCost。
 *
 * @param variant - 規格組合
 * @param product - 商品
 * @returns 有效進貨成本
 */
export function resolveEffectiveCost(
  variant: ProductVariant,
  product: Product,
): number {
  return variant.cost !== null
    ? variant.cost
    : product.defaultCost;
}

/**
 * 驗證明細項目的規格組合選取。
 *
 * - 若商品有規格組合（variants.length > 0）但 variantId 為 null，回傳驗證失敗。
 * - 若商品無規格組合（variants.length === 0），variantId 為 null 時驗證通過。
 * - 若商品有規格組合且 variantId 不為 null，驗證通過。
 *
 * @param product - 商品物件（含 variants 列表）
 * @param variantId - 規格組合 ID（無規格組合時為 null）
 * @returns 驗證結果
 */
export function validateVariantRequired(
  product: Product,
  variantId: string | null,
): ValidationResult {
  if (product.variants.length > 0 && variantId === null) {
    return { valid: false, error: "請選取規格組合" };
  }
  return { valid: true };
}
