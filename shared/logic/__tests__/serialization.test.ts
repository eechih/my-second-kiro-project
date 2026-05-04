/**
 * 序列化與反序列化工具函式——單元測試
 *
 * 驗證 serialize → deserialize 往返一致性，以及反序列化無效 JSON 時拋出錯誤。
 * 需求：10.1, 10.2, 10.3, 10.4
 */

import {
  serializeOrder,
  deserializeOrder,
  serializeProduct,
  deserializeProduct,
  serializeCustomer,
  deserializeCustomer,
  serializeSupplier,
  deserializeSupplier,
} from "../serialization";
import type { Order } from "../../models/order";
import type { Product } from "../../models/product";
import type { Customer } from "../../models/customer";
import type { Supplier } from "../../models/supplier";

// ---------------------------------------------------------------------------
// 測試資料工廠
// ---------------------------------------------------------------------------

function createSampleCustomer(): Customer {
  return {
    id: "cust-001",
    name: "測試客戶",
    contactPerson: "王小明",
    phone: "0912345678",
    email: "test@example.com",
    address: "台北市信義區",
    isActive: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

function createSampleSupplier(): Supplier {
  return {
    id: "sup-001",
    name: "測試供應商",
    contactPerson: "李大華",
    phone: "0987654321",
    email: "supplier@example.com",
    address: "新北市板橋區",
    isActive: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

function createSampleProduct(): Product {
  return {
    id: "prod-001",
    name: "測試商品",
    sku: "TEST-001",
    unitPrice: 100,
    defaultCost: 50,
    defaultSupplierId: "sup-001",
    stockQuantity: 200,
    specDimensions: [
      { name: "顏色", values: ["紅", "黑"] },
      { name: "尺寸", values: ["L", "M"] },
    ],
    variants: [
      {
        id: "var-001",
        combination: { 顏色: "紅", 尺寸: "L" },
        label: "紅 L",
        sku: "TEST-001-紅-L",
        stockQuantity: 50,
        unitPriceOverride: null,
        defaultCostOverride: null,
        version: 1,
      },
      {
        id: "var-002",
        combination: { 顏色: "黑", 尺寸: "M" },
        label: "黑 M",
        sku: "TEST-001-黑-M",
        stockQuantity: 30,
        unitPriceOverride: 120,
        defaultCostOverride: 60,
        version: 1,
      },
    ],
    imageUrls: ["product-images/prod-001/photo1.jpg"],
    isActive: true,
    version: 1,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

function createSampleOrder(): Order {
  return {
    id: "order-001",
    orderNumber: "ORD-20250101-001",
    customerId: "cust-001",
    customerName: "測試客戶",
    lineItems: [
      {
        id: "li-001",
        productId: "prod-001",
        productName: "測試商品",
        variantId: "var-001",
        variantLabel: "紅 L",
        quantity: 10,
        unitPrice: 100,
        subtotal: 1000,
        status: "待處理",
        purchasedQuantity: 0,
        shippedQuantity: 0,
        purchaseRecords: [
          {
            id: "pr-001",
            lineItemId: "li-001",
            supplierId: "sup-001",
            supplierName: "測試供應商",
            quantity: 5,
            unitCost: 50,
            status: "pending",
            statusHistory: [],
            purchasedAt: "2025-01-02T00:00:00.000Z",
            receivedAt: null,
          },
        ],
        orderedAt: null,
        receivedAt: null,
        shippedAt: null,
      },
      {
        id: "li-002",
        productId: "prod-002",
        productName: "無規格商品",
        variantId: null,
        variantLabel: null,
        quantity: 5,
        unitPrice: 200,
        subtotal: 1000,
        status: "已訂購",
        purchasedQuantity: 5,
        shippedQuantity: 0,
        purchaseRecords: [],
        orderedAt: "2025-01-02T00:00:00.000Z",
        receivedAt: null,
        shippedAt: null,
      },
    ],
    totalAmount: 2000,
    status: "pending",
    statusHistory: [
      {
        fromStatus: "",
        toStatus: "pending",
        changedAt: "2025-01-01T00:00:00.000Z",
      },
    ],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// Customer 序列化測試
// ---------------------------------------------------------------------------

describe("serializeCustomer / deserializeCustomer", () => {
  it("往返序列化應產生深度相等的物件", () => {
    const original = createSampleCustomer();
    const json = serializeCustomer(original);
    const restored = deserializeCustomer(json);
    expect(restored).toEqual(original);
  });

  it("停用客戶的 isActive=false 應正確保留", () => {
    const original = { ...createSampleCustomer(), isActive: false };
    const json = serializeCustomer(original);
    const restored = deserializeCustomer(json);
    expect(restored.isActive).toBe(false);
  });

  it("反序列化無效 JSON 應拋出錯誤", () => {
    expect(() => deserializeCustomer("not-json")).toThrow();
  });

  it("反序列化缺少必填欄位的物件應拋出錯誤", () => {
    const incomplete = JSON.stringify({ id: "cust-001" });
    expect(() => deserializeCustomer(incomplete)).toThrow("反序列化失敗");
  });

  it("反序列化非物件值應拋出錯誤", () => {
    expect(() => deserializeCustomer('"just a string"')).toThrow(
      "反序列化失敗",
    );
    expect(() => deserializeCustomer("123")).toThrow("反序列化失敗");
    expect(() => deserializeCustomer("null")).toThrow("反序列化失敗");
    expect(() => deserializeCustomer("[]")).toThrow("反序列化失敗");
  });
});

// ---------------------------------------------------------------------------
// Supplier 序列化測試
// ---------------------------------------------------------------------------

describe("serializeSupplier / deserializeSupplier", () => {
  it("往返序列化應產生深度相等的物件", () => {
    const original = createSampleSupplier();
    const json = serializeSupplier(original);
    const restored = deserializeSupplier(json);
    expect(restored).toEqual(original);
  });

  it("反序列化無效 JSON 應拋出錯誤", () => {
    expect(() => deserializeSupplier("not-json")).toThrow();
  });

  it("反序列化缺少必填欄位的物件應拋出錯誤", () => {
    const incomplete = JSON.stringify({ id: "sup-001", name: "test" });
    expect(() => deserializeSupplier(incomplete)).toThrow("反序列化失敗");
  });
});

// ---------------------------------------------------------------------------
// Product 序列化測試
// ---------------------------------------------------------------------------

describe("serializeProduct / deserializeProduct", () => {
  it("往返序列化應產生深度相等的物件（含規格組合）", () => {
    const original = createSampleProduct();
    const json = serializeProduct(original);
    const restored = deserializeProduct(json);
    expect(restored).toEqual(original);
  });

  it("無規格組合的商品往返序列化應正確", () => {
    const original: Product = {
      ...createSampleProduct(),
      specDimensions: [],
      variants: [],
      defaultSupplierId: null,
    };
    const json = serializeProduct(original);
    const restored = deserializeProduct(json);
    expect(restored).toEqual(original);
    expect(restored.defaultSupplierId).toBeNull();
    expect(restored.variants).toEqual([]);
  });

  it("規格組合的 null 覆寫值應正確保留", () => {
    const original = createSampleProduct();
    const json = serializeProduct(original);
    const restored = deserializeProduct(json);
    expect(restored.variants[0]!.unitPriceOverride).toBeNull();
    expect(restored.variants[0]!.defaultCostOverride).toBeNull();
    expect(restored.variants[1]!.unitPriceOverride).toBe(120);
    expect(restored.variants[1]!.defaultCostOverride).toBe(60);
  });

  it("反序列化無效 JSON 應拋出錯誤", () => {
    expect(() => deserializeProduct("not-json")).toThrow();
  });

  it("反序列化缺少必填欄位的物件應拋出錯誤", () => {
    const incomplete = JSON.stringify({ id: "prod-001" });
    expect(() => deserializeProduct(incomplete)).toThrow("反序列化失敗");
  });
});

// ---------------------------------------------------------------------------
// Order 序列化測試
// ---------------------------------------------------------------------------

describe("serializeOrder / deserializeOrder", () => {
  it("往返序列化應產生深度相等的物件（含明細、採購記錄）", () => {
    const original = createSampleOrder();
    const json = serializeOrder(original);
    const restored = deserializeOrder(json);
    expect(restored).toEqual(original);
  });

  it("明細項目的 null 欄位應正確保留", () => {
    const original = createSampleOrder();
    const json = serializeOrder(original);
    const restored = deserializeOrder(json);

    // 第一筆明細有 variantId，第二筆為 null
    expect(restored.lineItems[0]!.variantId).toBe("var-001");
    expect(restored.lineItems[1]!.variantId).toBeNull();
    expect(restored.lineItems[1]!.variantLabel).toBeNull();

    // 採購記錄的 receivedAt 為 null
    expect(restored.lineItems[0]!.purchaseRecords[0]!.receivedAt).toBeNull();
  });

  it("空明細項目的訂單往返序列化應正確", () => {
    const original: Order = {
      ...createSampleOrder(),
      lineItems: [],
      totalAmount: 0,
    };
    const json = serializeOrder(original);
    const restored = deserializeOrder(json);
    expect(restored).toEqual(original);
    expect(restored.lineItems).toEqual([]);
  });

  it("狀態歷史記錄應正確保留", () => {
    const original = createSampleOrder();
    const json = serializeOrder(original);
    const restored = deserializeOrder(json);
    expect(restored.statusHistory).toHaveLength(1);
    expect(restored.statusHistory[0]!.toStatus).toBe("pending");
  });

  it("反序列化無效 JSON 應拋出錯誤", () => {
    expect(() => deserializeOrder("not-json")).toThrow();
  });

  it("反序列化缺少必填欄位的物件應拋出錯誤", () => {
    const incomplete = JSON.stringify({ id: "order-001" });
    expect(() => deserializeOrder(incomplete)).toThrow("反序列化失敗");
  });
});
