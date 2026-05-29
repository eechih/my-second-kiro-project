/**
 * 商品規格選項純函式
 *
 * 提供 option-based 的價格/成本解析、標籤組合與必選驗證。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：3.12, 3.13, 3.14, 3.15, 4.12, 4.13
 */

import type { ValidationResult } from "../models/order";
import type { Product, ProductOptionValue } from "../models/product";

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
