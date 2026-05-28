/**
 * 規格選項（Product Variant）純函式
 *
 * 提供價格/成本解析（偏移量模式）、必選驗證等函式。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 偏移量模式：variant.priceOffset / costOffset 為相對於商品預設值的增減量。
 * - null 或 0 表示沿用商品預設值
 * - 正值表示加價（如 +50 表示比預設貴 50）
 * - 負值表示減價（如 -20 表示比預設便宜 20）
 *
 * 需求：3.12, 3.13, 3.14, 3.15, 4.12, 4.13
 */

import type { ValidationResult } from "../models/order";
import type {
  Product,
  ProductOptionValue,
  ProductVariant,
} from "../models/product";

/**
 * 解析規格組合的有效單價。
 *
 * 有效單價 = product.unitPrice + (variant.priceOffset ?? 0)
 *
 * @param variant - 規格組合
 * @param product - 商品
 * @returns 有效單價
 */
export function resolveEffectivePrice(
  variant: ProductVariant,
  product: Product,
): number {
  return product.price + (variant.priceOffset ?? 0);
}

/**
 * 解析規格組合的有效進貨成本。
 *
 * 有效成本 = product.defaultCost + (variant.costOffset ?? 0)
 *
 * @param variant - 規格組合
 * @param product - 商品
 * @returns 有效進貨成本
 */
export function resolveEffectiveCost(
  variant: ProductVariant,
  product: Product,
): number {
  return product.cost + (variant.costOffset ?? 0);
}

/**
 * 驗證明細項目的規格組合選取。
 *
 * - 若商品有規格組合（variants.length > 0）但 variantLabel 為 null 或空字串，回傳驗證失敗。
 * - 若商品無規格組合（variants.length === 0），variantLabel 為 null 時驗證通過。
 * - 若商品有規格組合且 variantLabel 為非空字串，驗證通過。
 *
 * @param product - 商品物件（含 variants 列表）
 * @param variantLabel - 規格組合顯示標籤（無規格組合時為 null）
 * @returns 驗證結果
 */
export function validateVariantRequired(
  product: Product,
  variantLabel: string | null,
): ValidationResult {
  if (product.options.length > 0) {
    return { valid: true };
  }

  if (
    product.variants.length > 0 &&
    (variantLabel === null || variantLabel.trim() === "")
  ) {
    return { valid: false, error: "請選取規格組合" };
  }
  return { valid: true };
}

export function buildOptionVariantLabel(
  selectedValues: ProductOptionValue[],
): string | null {
  if (selectedValues.length === 0) {
    return null;
  }

  return selectedValues
    .map((value) => value.name.trim())
    .filter(Boolean)
    .join(" / ");
}

export function resolveEffectivePriceFromOptions(
  product: Product,
  selectedValues: ProductOptionValue[],
): number {
  return (
    product.price +
    selectedValues.reduce((total, value) => total + (value.priceOffset ?? 0), 0)
  );
}

export function resolveEffectiveCostFromOptions(
  product: Product,
  selectedValues: ProductOptionValue[],
): number {
  return (
    product.cost +
    selectedValues.reduce((total, value) => total + (value.costOffset ?? 0), 0)
  );
}

export function validateOptionValuesRequired(
  product: Product,
  selectedValues: ProductOptionValue[],
): ValidationResult {
  if (product.options.length === 0) {
    return { valid: true };
  }

  if (selectedValues.length !== product.options.length) {
    return { valid: false, error: "請選取所有規格選項" };
  }

  const allSelected = product.options.every((option) =>
    selectedValues.some((value) =>
      option.values.some((candidate) => candidate.id === value.id),
    ),
  );

  if (!allSelected) {
    return { valid: false, error: "請選取所有規格選項" };
  }

  return { valid: true };
}
