/**
 * 規格組合（Product Variant）純函式
 *
 * 提供規格組合產生（笛卡爾積）、SKU 產生、價格/成本解析、必選驗證等函式。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：3.12, 3.13, 3.14, 3.15, 4.12, 4.13
 */

import type { ValidationResult } from "../models/order";
import type { Product, ProductVariant, SpecDimension } from "../models/product";

/**
 * 根據規格維度產生所有規格組合（笛卡爾積）。
 *
 * 例如：
 * ```
 * [{name:"顏色", values:["紅","黑"]}, {name:"尺寸", values:["L","M"]}]
 * ```
 * 產生 4 個組合：紅 L、紅 M、黑 L、黑 M
 *
 * 若 specDimensions 為空陣列或任一維度的 values 為空，回傳空陣列。
 *
 * @param specDimensions - 規格維度定義列表
 * @returns 規格組合列表（不含 id，由呼叫端指派）
 */
export function generateVariants(
  specDimensions: SpecDimension[],
): Omit<ProductVariant, "id">[] {
  if (specDimensions.length === 0) {
    return [];
  }

  // 若任一維度的 values 為空，無法產生組合
  if (specDimensions.some((dim) => dim.values.length === 0)) {
    return [];
  }

  // 計算笛卡爾積
  const combinations = cartesianProduct(specDimensions);

  return combinations.map((combination) => {
    const label = specDimensions.map((dim) => combination[dim.name]).join(" ");

    return {
      combination,
      label,
      sku: "", // SKU 由呼叫端透過 generateVariantSku 產生或自訂
      stockQuantity: 0,
      unitPriceOverride: null,
      defaultCostOverride: null,
      version: 1,
    };
  });
}

/**
 * 計算規格維度的笛卡爾積。
 *
 * @param dimensions - 規格維度列表
 * @returns 所有組合的 Record<string, string> 陣列
 */
function cartesianProduct(
  dimensions: SpecDimension[],
): Record<string, string>[] {
  let result: Record<string, string>[] = [{}];

  for (const dimension of dimensions) {
    const next: Record<string, string>[] = [];
    for (const existing of result) {
      for (const value of dimension.values) {
        next.push({ ...existing, [dimension.name]: value });
      }
    }
    result = next;
  }

  return result;
}

/**
 * 根據商品 SKU 與規格組合自動產生規格組合 SKU。
 *
 * 將商品 SKU 與規格組合的各維度值以 "-" 串接。
 * 例如：productSku="SHIRT-001", combination={顏色:"黑", 尺寸:"L"} → "SHIRT-001-黑-L"
 *
 * 組合值的順序依據 combination 物件的鍵順序（Object.values）。
 *
 * @param productSku - 商品 SKU
 * @param combination - 規格組合（如 { "顏色": "黑", "尺寸": "L" }）
 * @returns 規格組合 SKU
 */
export function generateVariantSku(
  productSku: string,
  combination: Record<string, string>,
): string {
  const values = Object.values(combination);
  if (values.length === 0) {
    return productSku;
  }
  return `${productSku}-${values.join("-")}`;
}

/**
 * 解析規格組合的有效單價。
 *
 * 若 variant.unitPriceOverride 不為 null，回傳覆寫值；
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
  return variant.unitPriceOverride !== null
    ? variant.unitPriceOverride
    : product.unitPrice;
}

/**
 * 解析規格組合的有效進貨成本。
 *
 * 若 variant.defaultCostOverride 不為 null，回傳覆寫值；
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
  return variant.defaultCostOverride !== null
    ? variant.defaultCostOverride
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
