/**
 * 規格組合純函式——屬性測試
 *
 * 屬性 17：規格組合產生——笛卡爾積正確性與 SKU 唯一性
 *   對任意規格維度，generateVariants 產生的組合數量等於各維度選項值數量的乘積，
 *   無重複組合，且所有自動產生的 SKU 互不相同。
 *
 * 屬性 18：規格組合價格/成本解析——覆寫優先
 *   resolveEffectivePrice / resolveEffectiveCost 在覆寫值不為 null 時回傳覆寫值，
 *   否則回傳商品預設值。
 *
 * 屬性 19：規格組合必選驗證
 *   商品有規格組合但 variantId 為 null 時驗證失敗；
 *   商品無規格組合時 variantId 為 null 驗證通過。
 *
 * 驗證需求：3.13, 3.14, 3.15, 4.12, 4.13
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  generateVariants,
  generateVariantSku,
  resolveEffectivePrice,
  resolveEffectiveCost,
  validateVariantRequired,
} from "../product-variant";
import type {
  Product,
  ProductVariant,
  SpecDimension,
} from "../../models/product";

// ---------------------------------------------------------------------------
// 輔助 Arbitrary
// ---------------------------------------------------------------------------

/** 可用於維度名稱與選項值的字元集 */
const SAFE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

/** 產生非空字串（用於維度名稱與選項值，不含 "-" 以避免 SKU 衝突） */
const nonEmptyStringArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...SAFE_CHARS), { minLength: 1, maxLength: 6 })
  .map((chars) => chars.join(""));

/** 產生唯一維度名稱的非空陣列 */
const uniqueDimNamesArb = (count: number): fc.Arbitrary<string[]> =>
  fc.uniqueArray(nonEmptyStringArb, { minLength: count, maxLength: count });

/** 產生單一規格維度（含 1~4 個唯一選項值） */
const specDimensionArb = (name: string): fc.Arbitrary<SpecDimension> =>
  fc
    .uniqueArray(nonEmptyStringArb, { minLength: 1, maxLength: 4 })
    .map((values) => ({ name, values }));

/** 產生 1~3 組規格維度（維度名稱互不相同，每組 1~4 個唯一選項值） */
const specDimensionsArb: fc.Arbitrary<SpecDimension[]> = fc
  .integer({ min: 1, max: 3 })
  .chain((count) =>
    uniqueDimNamesArb(count).chain((names) =>
      fc.tuple(...names.map((n) => specDimensionArb(n))),
    ),
  )
  .map((dims) => [...dims]);

/** 產生非負數（用於價格/成本） */
const nonNegativeNumberArb: fc.Arbitrary<number> = fc.integer({
  min: 0,
  max: 100000,
});

/** 產生正數（用於價格/成本覆寫） */
const positiveNumberArb: fc.Arbitrary<number> = fc.integer({
  min: 1,
  max: 100000,
});

/** 產生 SKU 字串 */
const SKU_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
const skuArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...SKU_CHARS), { minLength: 3, maxLength: 10 })
  .map((chars) => chars.join(""));

/** 產生一個最小化的 Product 物件（用於 resolveEffective* 測試） */
const productArb: fc.Arbitrary<Product> = fc
  .record({
    unitPrice: nonNegativeNumberArb,
    defaultCost: nonNegativeNumberArb,
  })
  .map(({ unitPrice, defaultCost }) => ({
    id: "prod-1",
    name: "測試商品",
    sku: "TEST-001",
    unitPrice,
    defaultCost,
    defaultSupplierId: null,
    stockQuantity: 0,
    specDimensions: [],
    variants: [],
    imageUrls: [],
    isActive: true,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

/** 產生一個 ProductVariant 物件 */
const variantArb: fc.Arbitrary<ProductVariant> = fc
  .record({
    unitPriceOverride: fc.option(positiveNumberArb, { nil: null }),
    defaultCostOverride: fc.option(positiveNumberArb, { nil: null }),
  })
  .map(({ unitPriceOverride, defaultCostOverride }) => ({
    id: "var-1",
    combination: { 顏色: "黑", 尺寸: "L" },
    label: "黑 L",
    sku: "TEST-001-黑-L",
    stockQuantity: 10,
    unitPriceOverride,
    defaultCostOverride,
    version: 1,
  }));

// ---------------------------------------------------------------------------
// 屬性 17：規格組合產生——笛卡爾積正確性與 SKU 唯一性
// ---------------------------------------------------------------------------

describe("屬性 17：規格組合產生——笛卡爾積正確性與 SKU 唯一性", () => {
  it("產生的組合數量應等於各維度選項值數量的乘積", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        const variants = generateVariants(dims);
        const expectedCount = dims.reduce(
          (acc, dim) => acc * dim.values.length,
          1,
        );

        expect(variants).toHaveLength(expectedCount);
      }),
      { numRuns: 200 },
    );
  });

  it("產生的組合不應有重複（每個 combination 唯一）", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        const variants = generateVariants(dims);
        const combinationKeys = variants.map((v) =>
          JSON.stringify(
            Object.entries(v.combination).sort(([a], [b]) =>
              a.localeCompare(b),
            ),
          ),
        );
        const uniqueKeys = new Set(combinationKeys);

        expect(uniqueKeys.size).toBe(variants.length);
      }),
      { numRuns: 200 },
    );
  });

  it("每個組合應包含所有維度的鍵", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        const variants = generateVariants(dims);
        const dimNames = dims.map((d) => d.name);

        for (const variant of variants) {
          const keys = Object.keys(variant.combination);
          expect(keys.sort()).toEqual([...dimNames].sort());
        }
      }),
      { numRuns: 200 },
    );
  });

  it("每個組合的值應來自對應維度的選項值", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        const variants = generateVariants(dims);

        for (const variant of variants) {
          for (const dim of dims) {
            const value = variant.combination[dim.name];
            expect(dim.values).toContain(value);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("label 應為各維度值以空格串接", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        const variants = generateVariants(dims);

        for (const variant of variants) {
          const expectedLabel = dims
            .map((dim) => variant.combination[dim.name])
            .join(" ");
          expect(variant.label).toBe(expectedLabel);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("所有自動產生的 SKU（透過 generateVariantSku）應互不相同", () => {
    fc.assert(
      fc.property(skuArb, specDimensionsArb, (productSku, dims) => {
        const variants = generateVariants(dims);
        const skus = variants.map((v) =>
          generateVariantSku(productSku, v.combination),
        );
        const uniqueSkus = new Set(skus);

        expect(uniqueSkus.size).toBe(skus.length);
      }),
      { numRuns: 200 },
    );
  });

  it("generateVariantSku 應以商品 SKU 為前綴", () => {
    fc.assert(
      fc.property(skuArb, specDimensionsArb, (productSku, dims) => {
        const variants = generateVariants(dims);

        for (const variant of variants) {
          const sku = generateVariantSku(productSku, variant.combination);
          expect(sku.startsWith(productSku)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("空規格維度應產生空陣列", () => {
    const variants = generateVariants([]);
    expect(variants).toHaveLength(0);
  });

  it("任一維度的 values 為空時應產生空陣列", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        // 將第一個維度的 values 設為空
        const modified = [
          { name: dims[0]!.name, values: [] as string[] },
          ...dims.slice(1),
        ];
        const variants = generateVariants(modified);

        expect(variants).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it("初始 stockQuantity 應為 0，version 應為 1", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        const variants = generateVariants(dims);

        for (const variant of variants) {
          expect(variant.stockQuantity).toBe(0);
          expect(variant.version).toBe(1);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("初始 unitPriceOverride 與 defaultCostOverride 應為 null", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        const variants = generateVariants(dims);

        for (const variant of variants) {
          expect(variant.unitPriceOverride).toBeNull();
          expect(variant.defaultCostOverride).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  it("generateVariantSku 在空 combination 時應回傳原始 productSku", () => {
    fc.assert(
      fc.property(skuArb, (productSku) => {
        const sku = generateVariantSku(productSku, {});
        expect(sku).toBe(productSku);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// 屬性 18：規格組合價格/成本解析——覆寫優先
// ---------------------------------------------------------------------------

describe("屬性 18：規格組合價格/成本解析——覆寫優先", () => {
  it("unitPriceOverride 不為 null 時，resolveEffectivePrice 應回傳覆寫值", () => {
    fc.assert(
      fc.property(positiveNumberArb, productArb, (overridePrice, product) => {
        const variant: ProductVariant = {
          id: "var-1",
          combination: {},
          label: "",
          sku: "",
          stockQuantity: 0,
          unitPriceOverride: overridePrice,
          defaultCostOverride: null,
          version: 1,
        };

        expect(resolveEffectivePrice(variant, product)).toBe(overridePrice);
      }),
      { numRuns: 200 },
    );
  });

  it("unitPriceOverride 為 null 時，resolveEffectivePrice 應回傳商品預設單價", () => {
    fc.assert(
      fc.property(productArb, (product) => {
        const variant: ProductVariant = {
          id: "var-1",
          combination: {},
          label: "",
          sku: "",
          stockQuantity: 0,
          unitPriceOverride: null,
          defaultCostOverride: null,
          version: 1,
        };

        expect(resolveEffectivePrice(variant, product)).toBe(product.unitPrice);
      }),
      { numRuns: 200 },
    );
  });

  it("defaultCostOverride 不為 null 時，resolveEffectiveCost 應回傳覆寫值", () => {
    fc.assert(
      fc.property(positiveNumberArb, productArb, (overrideCost, product) => {
        const variant: ProductVariant = {
          id: "var-1",
          combination: {},
          label: "",
          sku: "",
          stockQuantity: 0,
          unitPriceOverride: null,
          defaultCostOverride: overrideCost,
          version: 1,
        };

        expect(resolveEffectiveCost(variant, product)).toBe(overrideCost);
      }),
      { numRuns: 200 },
    );
  });

  it("defaultCostOverride 為 null 時，resolveEffectiveCost 應回傳商品預設成本", () => {
    fc.assert(
      fc.property(productArb, (product) => {
        const variant: ProductVariant = {
          id: "var-1",
          combination: {},
          label: "",
          sku: "",
          stockQuantity: 0,
          unitPriceOverride: null,
          defaultCostOverride: null,
          version: 1,
        };

        expect(resolveEffectiveCost(variant, product)).toBe(
          product.defaultCost,
        );
      }),
      { numRuns: 200 },
    );
  });

  it("覆寫值與商品預設值不同時，resolveEffectivePrice 應回傳覆寫值而非預設值", () => {
    fc.assert(
      fc.property(
        positiveNumberArb,
        positiveNumberArb,
        (overridePrice, defaultPrice) => {
          fc.pre(overridePrice !== defaultPrice);

          const product: Product = {
            id: "prod-1",
            name: "測試",
            sku: "T-001",
            unitPrice: defaultPrice,
            defaultCost: 0,
            defaultSupplierId: null,
            stockQuantity: 0,
            specDimensions: [],
            variants: [],
            imageUrls: [],
            isActive: true,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const variant: ProductVariant = {
            id: "var-1",
            combination: {},
            label: "",
            sku: "",
            stockQuantity: 0,
            unitPriceOverride: overridePrice,
            defaultCostOverride: null,
            version: 1,
          };

          const result = resolveEffectivePrice(variant, product);
          expect(result).toBe(overridePrice);
          expect(result).not.toBe(defaultPrice);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("覆寫值與商品預設值不同時，resolveEffectiveCost 應回傳覆寫值而非預設值", () => {
    fc.assert(
      fc.property(
        positiveNumberArb,
        positiveNumberArb,
        (overrideCost, defaultCost) => {
          fc.pre(overrideCost !== defaultCost);

          const product: Product = {
            id: "prod-1",
            name: "測試",
            sku: "T-001",
            unitPrice: 0,
            defaultCost,
            defaultSupplierId: null,
            stockQuantity: 0,
            specDimensions: [],
            variants: [],
            imageUrls: [],
            isActive: true,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const variant: ProductVariant = {
            id: "var-1",
            combination: {},
            label: "",
            sku: "",
            stockQuantity: 0,
            unitPriceOverride: null,
            defaultCostOverride: overrideCost,
            version: 1,
          };

          const result = resolveEffectiveCost(variant, product);
          expect(result).toBe(overrideCost);
          expect(result).not.toBe(defaultCost);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("同時覆寫單價與成本時，兩者皆應回傳覆寫值", () => {
    fc.assert(
      fc.property(variantArb, productArb, (variant, product) => {
        const price = resolveEffectivePrice(variant, product);
        const cost = resolveEffectiveCost(variant, product);

        if (variant.unitPriceOverride !== null) {
          expect(price).toBe(variant.unitPriceOverride);
        } else {
          expect(price).toBe(product.unitPrice);
        }

        if (variant.defaultCostOverride !== null) {
          expect(cost).toBe(variant.defaultCostOverride);
        } else {
          expect(cost).toBe(product.defaultCost);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// 屬性 19：規格組合必選驗證
// ---------------------------------------------------------------------------

describe("屬性 19：規格組合必選驗證", () => {
  it("商品有規格組合但 variantId 為 null 時，驗證應失敗", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (variantCount) => {
        const variants: ProductVariant[] = Array.from(
          { length: variantCount },
          (_, i) => ({
            id: `var-${i}`,
            combination: { 顏色: `色${i}` },
            label: `色${i}`,
            sku: `SKU-${i}`,
            stockQuantity: 0,
            unitPriceOverride: null,
            defaultCostOverride: null,
            version: 1,
          }),
        );

        const product: Product = {
          id: "prod-1",
          name: "測試商品",
          sku: "TEST-001",
          unitPrice: 100,
          defaultCost: 50,
          defaultSupplierId: null,
          stockQuantity: 0,
          specDimensions: [
            { name: "顏色", values: variants.map((_, i) => `色${i}`) },
          ],
          variants,
          imageUrls: [],
          isActive: true,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = validateVariantRequired(product, null);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toBe("請選取規格組合");
      }),
      { numRuns: 100 },
    );
  });

  it("商品有規格組合且 variantId 不為 null 時，驗證應通過", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        nonEmptyStringArb,
        (variantCount, variantId) => {
          const variants: ProductVariant[] = Array.from(
            { length: variantCount },
            (_, i) => ({
              id: `var-${i}`,
              combination: { 顏色: `色${i}` },
              label: `色${i}`,
              sku: `SKU-${i}`,
              stockQuantity: 0,
              unitPriceOverride: null,
              defaultCostOverride: null,
              version: 1,
            }),
          );

          const product: Product = {
            id: "prod-1",
            name: "測試商品",
            sku: "TEST-001",
            unitPrice: 100,
            defaultCost: 50,
            defaultSupplierId: null,
            stockQuantity: 0,
            specDimensions: [
              { name: "顏色", values: variants.map((_, i) => `色${i}`) },
            ],
            variants,
            imageUrls: [],
            isActive: true,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const result = validateVariantRequired(product, variantId);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("商品無規格組合且 variantId 為 null 時，驗證應通過", () => {
    fc.assert(
      fc.property(productArb, (product) => {
        // productArb 產生的商品 variants 為空陣列
        const result = validateVariantRequired(product, null);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("商品無規格組合且 variantId 不為 null 時，驗證仍應通過", () => {
    fc.assert(
      fc.property(productArb, nonEmptyStringArb, (product, variantId) => {
        // 商品無規格組合，即使提供 variantId 也不應報錯
        const result = validateVariantRequired(product, variantId);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("驗證結果的 valid 與 error 應互斥：valid=true 時無 error，valid=false 時有 error", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(nonEmptyStringArb, { nil: null }),
        (hasVariants, variantId) => {
          const variants: ProductVariant[] = hasVariants
            ? [
                {
                  id: "var-1",
                  combination: { 顏色: "黑" },
                  label: "黑",
                  sku: "SKU-1",
                  stockQuantity: 0,
                  unitPriceOverride: null,
                  defaultCostOverride: null,
                  version: 1,
                },
              ]
            : [];

          const product: Product = {
            id: "prod-1",
            name: "測試商品",
            sku: "TEST-001",
            unitPrice: 100,
            defaultCost: 50,
            defaultSupplierId: null,
            stockQuantity: 0,
            specDimensions: hasVariants
              ? [{ name: "顏色", values: ["黑"] }]
              : [],
            variants,
            imageUrls: [],
            isActive: true,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const result = validateVariantRequired(product, variantId);

          if (result.valid) {
            expect(result.error).toBeUndefined();
          } else {
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe("string");
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
