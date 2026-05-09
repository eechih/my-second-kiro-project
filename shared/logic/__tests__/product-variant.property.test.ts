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
    unitPrice: 100,
    defaultCost: 50,
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

function createVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: "var-1",
    label: "黑色",
    price: null,
    cost: null,
    ...overrides,
  };
}

describe("resolveEffectivePrice / resolveEffectiveCost", () => {
  it("規格單價為 null 時使用商品預設單價", () => {
    fc.assert(
      fc.property(nonNegativeNumberArb, (unitPrice) => {
        const product = createProduct({ unitPrice });
        const variant = createVariant({ price: null });

        expect(resolveEffectivePrice(variant, product)).toBe(unitPrice);
      }),
      { numRuns: 200 },
    );
  });

  it("規格單價有值時優先使用覆寫單價", () => {
    fc.assert(
      fc.property(positiveNumberArb, (price) => {
        const product = createProduct({ unitPrice: 100 });
        const variant = createVariant({ price });

        expect(resolveEffectivePrice(variant, product)).toBe(price);
      }),
      { numRuns: 200 },
    );
  });

  it("規格成本為 null 時使用商品預設成本", () => {
    fc.assert(
      fc.property(nonNegativeNumberArb, (defaultCost) => {
        const product = createProduct({ defaultCost });
        const variant = createVariant({ cost: null });

        expect(resolveEffectiveCost(variant, product)).toBe(defaultCost);
      }),
      { numRuns: 200 },
    );
  });

  it("規格成本有值時優先使用覆寫成本", () => {
    fc.assert(
      fc.property(positiveNumberArb, (cost) => {
        const product = createProduct({ defaultCost: 50 });
        const variant = createVariant({ cost });

        expect(resolveEffectiveCost(variant, product)).toBe(cost);
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

  it("商品沒有規格選項時可不選規格", () => {
    const product = createProduct({ variants: [] });

    expect(validateVariantRequired(product, null)).toEqual({ valid: true });
  });
});
