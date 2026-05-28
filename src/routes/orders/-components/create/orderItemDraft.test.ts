import { describe, expect, it } from "vitest";
import type { Product, ProductOptionValue, ProductVariant } from "@shared/models";
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

const colorValue: ProductOptionValue = {
  id: "option-value-color",
  name: "黑",
  priceOffset: 20,
  costOffset: 10,
  sortOrder: 0,
};

const sizeValue: ProductOptionValue = {
  id: "option-value-size",
  name: "L",
  priceOffset: 30,
  costOffset: 5,
  sortOrder: 0,
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
  options: [],
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
      selectedOptionValues: [],
      quantity: 1,
      unitPrice: 0,
    });
  });

  it("requires variant selection when product has variants", () => {
    expect(
      getOrderItemDraftError({
        product: baseProduct,
        variant: null,
        selectedOptionValues: [],
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
        selectedOptionValues: [],
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
    expect(resolveDraftUnitPrice(baseProduct, null, [])).toBe(300);
    expect(resolveDraftUnitPrice(baseProduct, baseVariant, [])).toBe(350);
  });

  it("resolves unit price from selected option values when product uses options", () => {
    const optionProduct: Product = {
      ...baseProduct,
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
    };

    expect(resolveDraftUnitPrice(optionProduct, null, [colorValue, sizeValue])).toBe(
      350,
    );
  });

  it("builds order item data from selected option values", () => {
    const optionProduct: Product = {
      ...baseProduct,
      variants: [],
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
    };

    expect(
      buildOrderItemFormData({
        product: optionProduct,
        variant: null,
        selectedOptionValues: [colorValue, sizeValue],
        quantity: 1,
        unitPrice: 350,
      }),
    ).toEqual({
      productId: "product-1",
      productName: "測試商品",
      productSku: "SKU-001",
      variantLabel: "黑 / L",
      quantity: 1,
      unitPrice: 350,
    });
  });
});
