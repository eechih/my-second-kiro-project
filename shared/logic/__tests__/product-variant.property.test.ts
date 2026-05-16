/**
 * 規格選項純函式——屬性測試
 *
 * 驗證價格/成本解析與必選驗證。
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  resolveEffectiveCost,
  resolveEffectivePrice,
  validateVariantRequired,
} from "../product-variant";
import type { Product, ProductVariant } from "../../models/product";

const nonNegativeNumberArb: fc.Arbitrary<number> = fc.integer({
  min: 0,
  max: 100000,
});

const positiveNumberArb: fc.Arbitrary<number> = fc.integer({
  min: 1,
  max: 100000,
});

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    name: "測試商品",
    sku: "TEST-001",
    description: "",
    price: 100,
    cost: 50,
    defaultSupplierId: null,
    stockQuantity: 0,
    variants: [],
    imageUrls: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createVariant(
  overrides: Partial<ProductVariant> = {},
): ProductVariant {
  return {
    id: "var-1",
    label: "黑色",
    priceOffset: null,
    costOffset: null,
    ...overrides,
  };
}

describe("resolveEffectivePrice / resolveEffectiveCost", () => {
  it("偏移量為 null 時使用商品預設單價", () => {
    fc.assert(
      fc.property(nonNegativeNumberArb, (unitPrice) => {
        const product = createProduct({ price: unitPrice });
        const variant = createVariant({ priceOffset: null });

        expect(resolveEffectivePrice(variant, product)).toBe(unitPrice);
      }),
      { numRuns: 200 },
    );
  });

  it("偏移量為正值時加價", () => {
    fc.assert(
      fc.property(positiveNumberArb, (offset) => {
        const product = createProduct({ price: 100 });
        const variant = createVariant({ priceOffset: offset });

        expect(resolveEffectivePrice(variant, product)).toBe(100 + offset);
      }),
      { numRuns: 200 },
    );
  });

  it("偏移量為 0 時等同預設單價", () => {
    fc.assert(
      fc.property(nonNegativeNumberArb, (unitPrice) => {
        const product = createProduct({ price: unitPrice });
        const variant = createVariant({ priceOffset: 0 });

        expect(resolveEffectivePrice(variant, product)).toBe(unitPrice);
      }),
      { numRuns: 200 },
    );
  });

  it("成本偏移量為 null 時使用商品預設成本", () => {
    fc.assert(
      fc.property(nonNegativeNumberArb, (defaultCost) => {
        const product = createProduct({ cost: defaultCost });
        const variant = createVariant({ costOffset: null });

        expect(resolveEffectiveCost(variant, product)).toBe(defaultCost);
      }),
      { numRuns: 200 },
    );
  });

  it("成本偏移量有值時加上偏移量", () => {
    fc.assert(
      fc.property(positiveNumberArb, (offset) => {
        const product = createProduct({ cost: 50 });
        const variant = createVariant({ costOffset: offset });

        expect(resolveEffectiveCost(variant, product)).toBe(50 + offset);
      }),
      { numRuns: 200 },
    );
  });
});

describe("validateVariantRequired", () => {
  it("商品有規格選項但未選規格時驗證失敗", () => {
    const product = createProduct({ variants: [createVariant()] });

    expect(validateVariantRequired(product, null)).toEqual({
      valid: false,
      error: "請選取規格組合",
    });
  });

  it("商品有規格選項但 variantLabel 為空字串時驗證失敗", () => {
    const product = createProduct({ variants: [createVariant()] });

    expect(validateVariantRequired(product, "")).toEqual({
      valid: false,
      error: "請選取規格組合",
    });
  });

  it("商品有規格選項但 variantLabel 為空白字串時驗證失敗", () => {
    const product = createProduct({ variants: [createVariant()] });

    expect(validateVariantRequired(product, "   ")).toEqual({
      valid: false,
      error: "請選取規格組合",
    });
  });

  it("商品沒有規格選項時可不選規格", () => {
    const product = createProduct({ variants: [] });

    expect(validateVariantRequired(product, null)).toEqual({ valid: true });
  });

  it("商品有規格選項且 variantLabel 為非空字串時驗證通過", () => {
    const product = createProduct({ variants: [createVariant()] });

    expect(validateVariantRequired(product, "黑色")).toEqual({ valid: true });
  });
});
