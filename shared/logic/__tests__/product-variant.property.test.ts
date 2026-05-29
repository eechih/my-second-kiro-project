/**
 * 規格選項純函式——屬性測試
 *
 * 驗證 option-based 的價格/成本解析、標籤組合與必選驗證。
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildOptionVariantLabel,
  resolveEffectiveCostFromOptions,
  resolveEffectivePriceFromOptions,
  validateOptionValuesRequired,
} from "../product-variant";
import type { Product, ProductOptionValue } from "../../models/product";

const nonNegativeNumberArb: fc.Arbitrary<number> = fc.integer({
  min: 0,
  max: 100000,
});

const positiveNumberArb: fc.Arbitrary<number> = fc.integer({
  min: 1,
  max: 100000,
});

function createOptionValue(
  id: string,
  name: string,
  overrides: Partial<ProductOptionValue> = {},
): ProductOptionValue {
  return {
    id,
    name,
    priceOffset: 0,
    costOffset: 0,
    sortOrder: 0,
    ...overrides,
  };
}

function createProduct(overrides: Partial<Product> = {}): Product {
  const colorValue = createOptionValue("color-black", "黑");
  const sizeValue = createOptionValue("size-l", "L");

  return {
    id: "prod-1",
    name: "測試商品",
    sku: "TEST-001",
    description: "",
    price: 100,
    cost: 50,
    defaultSupplierId: null,
    stockQuantity: 0,
    options: [
      {
        id: "option-color",
        name: "顏色",
        sortOrder: 0,
        values: [colorValue],
      },
      {
        id: "option-size",
        name: "尺寸",
        sortOrder: 1,
        values: [sizeValue],
      },
    ],
    imageUrls: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("resolveEffectivePriceFromOptions / resolveEffectiveCostFromOptions", () => {
  it("未選任何規格值時沿用商品預設單價", () => {
    fc.assert(
      fc.property(nonNegativeNumberArb, (unitPrice) => {
        const product = createProduct({ price: unitPrice });

        expect(resolveEffectivePriceFromOptions(product, [])).toBe(unitPrice);
      }),
      { numRuns: 200 },
    );
  });

  it("所有規格值的加價會正確累加", () => {
    fc.assert(
      fc.property(positiveNumberArb, positiveNumberArb, (offsetA, offsetB) => {
        const product = createProduct({ price: 100 });
        const values = [
          createOptionValue("value-a", "黑", { priceOffset: offsetA }),
          createOptionValue("value-b", "L", { priceOffset: offsetB }),
        ];

        expect(resolveEffectivePriceFromOptions(product, values)).toBe(
          100 + offsetA + offsetB,
        );
      }),
      { numRuns: 200 },
    );
  });

  it("未選任何規格值時沿用商品預設成本", () => {
    fc.assert(
      fc.property(nonNegativeNumberArb, (defaultCost) => {
        const product = createProduct({ cost: defaultCost });

        expect(resolveEffectiveCostFromOptions(product, [])).toBe(defaultCost);
      }),
      { numRuns: 200 },
    );
  });

  it("所有規格值的成本增加會正確累加", () => {
    fc.assert(
      fc.property(positiveNumberArb, positiveNumberArb, (offsetA, offsetB) => {
        const product = createProduct({ cost: 50 });
        const values = [
          createOptionValue("value-a", "黑", { costOffset: offsetA }),
          createOptionValue("value-b", "L", { costOffset: offsetB }),
        ];

        expect(resolveEffectiveCostFromOptions(product, values)).toBe(
          50 + offsetA + offsetB,
        );
      }),
      { numRuns: 200 },
    );
  });
});

describe("buildOptionVariantLabel", () => {
  it("會依序組出規格標籤", () => {
    expect(
      buildOptionVariantLabel([
        createOptionValue("color-black", "黑"),
        createOptionValue("size-l", "L"),
      ]),
    ).toBe("黑 / L");
  });

  it("空陣列時回傳 null", () => {
    expect(buildOptionVariantLabel([])).toBeNull();
  });
});

describe("validateOptionValuesRequired", () => {
  it("商品沒有規格時可不選任何規格值", () => {
    const product = createProduct({ options: [] });

    expect(validateOptionValuesRequired(product, [])).toEqual({ valid: true });
  });

  it("商品有規格但選取數量不足時驗證失敗", () => {
    const product = createProduct();

    expect(
      validateOptionValuesRequired(product, [
        createOptionValue("color-black", "黑"),
      ]),
    ).toEqual({
      valid: false,
      error: "請選取所有規格選項",
    });
  });

  it("商品有規格且每個規格都已選值時驗證通過", () => {
    const colorValue = createOptionValue("color-black", "黑");
    const sizeValue = createOptionValue("size-l", "L");
    const product = createProduct({
      options: [
        {
          id: "option-color",
          name: "顏色",
          sortOrder: 0,
          values: [colorValue],
        },
        {
          id: "option-size",
          name: "尺寸",
          sortOrder: 1,
          values: [sizeValue],
        },
      ],
    });

    expect(
      validateOptionValuesRequired(product, [colorValue, sizeValue]),
    ).toEqual({ valid: true });
  });
});
