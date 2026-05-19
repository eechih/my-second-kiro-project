import { describe, expect, it } from "vitest";
import type { Product, ProductVariant } from "@shared/models";
import {
  buildOrderItemFormData,
  createDefaultOrderItemDraft,
  getOrderItemDraftError,
  resolveDraftUnitPrice,
} from "./orderItemDraft";

const baseVariant: ProductVariant = {
  id: "variant-1",
  label: "黑 L",
  priceOffset: 50,
  costOffset: null,
};

const baseProduct: Product = {
  id: "product-1",
  name: "測試商品",
  sku: "SKU-001",
  description: "",
  price: 300,
  cost: 120,
  defaultSupplierId: null,
  stockQuantity: 10,
  variants: [baseVariant],
  imageUrls: [],
  isActive: true,
  createdAt: "2026-05-11T00:00:00.000Z",
  updatedAt: "2026-05-11T00:00:00.000Z",
};

describe("orderItemDraft", () => {
  it("creates the default draft for add dialog", () => {
    expect(createDefaultOrderItemDraft()).toEqual({
      product: null,
      variant: null,
      quantity: 1,
      unitPrice: 0,
    });
  });

  it("requires variant selection when product has variants", () => {
    expect(
      getOrderItemDraftError({
        product: baseProduct,
        variant: null,
        quantity: 1,
        unitPrice: 300,
      }),
    ).toBe("請選取規格組合");
  });

  it("builds order item data from a valid draft", () => {
    expect(
      buildOrderItemFormData({
        product: baseProduct,
        variant: baseVariant,
        quantity: 2,
        unitPrice: 350,
      }),
    ).toEqual({
      productId: "product-1",
      productName: "測試商品",
      productSku: "SKU-001",
      variantLabel: "黑 L",
      quantity: 2,
      unitPrice: 350,
    });
  });

  it("resolves unit price from product or selected variant", () => {
    expect(resolveDraftUnitPrice(baseProduct, null)).toBe(300);
    expect(resolveDraftUnitPrice(baseProduct, baseVariant)).toBe(350);
  });
});
