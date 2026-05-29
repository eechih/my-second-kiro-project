import { describe, expect, it } from "vitest";
import type { Product, ProductOptionValue } from "@shared/models";
import {
  buildOrderItemFormData,
  createDefaultOrderItemDraft,
  resolveDraftUnitPrice,
} from "./orderItemDraft";

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
  sequenceNumber: 1,
  description: "",
  price: 300,
  cost: 120,
  defaultSupplierId: null,
  stockQuantity: 10,
  options: [],
  imageUrls: [],
  isActive: true,
  createdAt: "2026-05-11T00:00:00.000Z",
  updatedAt: "2026-05-11T00:00:00.000Z",
};

describe("orderItemDraft", () => {
  it("creates the default draft for add dialog", () => {
    expect(createDefaultOrderItemDraft()).toEqual({
      product: null,
      selectedOptionValues: [],
      legacyVariantLabel: null,
      quantity: 1,
      unitPrice: 0,
    });
  });

  it("builds order item data from a simple draft", () => {
    expect(
      buildOrderItemFormData({
        product: baseProduct,
        selectedOptionValues: [],
        legacyVariantLabel: null,
        quantity: 2,
        unitPrice: 300,
      }),
    ).toEqual({
      productId: "product-1",
      productName: "測試商品",
      productImageUrl: null,
      productSku: "SKU-001",
      variantLabel: null,
      selectedOptionsSnapshot: [],
      quantity: 2,
      unitPrice: 300,
      unitCost: 120,
    });
  });

  it("resolves unit price from product base price when no options are selected", () => {
    expect(resolveDraftUnitPrice(baseProduct, [])).toBe(300);
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

    expect(resolveDraftUnitPrice(optionProduct, [colorValue, sizeValue])).toBe(
      350,
    );
  });

  it("builds order item data from selected option values", () => {
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

    expect(
      buildOrderItemFormData({
        product: optionProduct,
        selectedOptionValues: [colorValue, sizeValue],
        legacyVariantLabel: null,
        quantity: 1,
        unitPrice: 350,
      }),
    ).toEqual({
      productId: "product-1",
      productName: "測試商品",
      productImageUrl: null,
      productSku: "SKU-001",
      variantLabel: "黑 / L",
      selectedOptionsSnapshot: [
        {
          optionName: "顏色",
          valueName: "黑",
          priceOffset: 20,
          costOffset: 10,
        },
        {
          optionName: "尺寸",
          valueName: "L",
          priceOffset: 30,
          costOffset: 5,
        },
      ],
      quantity: 1,
      unitPrice: 350,
      unitCost: 135,
    });
  });

  it("preserves legacy variant label when editing old order items", () => {
    expect(
      buildOrderItemFormData({
        product: baseProduct,
        selectedOptionValues: [],
        legacyVariantLabel: "黑 L",
        quantity: 1,
        unitPrice: 350,
      }),
    ).toEqual({
      productId: "product-1",
      productName: "測試商品",
      productImageUrl: null,
      productSku: "SKU-001",
      variantLabel: "黑 L",
      selectedOptionsSnapshot: [],
      quantity: 1,
      unitPrice: 350,
      unitCost: 120,
    });
  });
});
