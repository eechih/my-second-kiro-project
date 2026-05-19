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
    translationParser: "wish",
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
    description: "商品描述",
    price: 100,
    cost: 50,
    defaultSupplierId: "sup-001",
    stockQuantity: 200,
    variants: [
      {
        id: "var-001",
        label: "紅 L",
        priceOffset: null,
        costOffset: null,
      },
      {
        id: "var-002",
        label: "黑 M",
        priceOffset: 20,
        costOffset: 10,
      },
    ],
    imageUrls: ["product-images/prod-001/photo1.jpg"],
    isActive: true,
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
    items: [
      {
        id: "li-001",
        productId: "prod-001",
        productName: "測試商品",
        variantLabel: "紅 L",
        quantity: 10,
        unitPrice: 100,
        subtotal: 1000,
        status: "pending",
        purchasedAt: null,
        receivedAt: null,
        shippedAt: null,
        outOfStockAt: null,
        supplierName: "測試供應商",
        unitCost: 50,
      },
      {
        id: "li-002",
        productId: "prod-002",
        productName: "無規格商品",
        variantLabel: null,
        quantity: 5,
        unitPrice: 200,
        subtotal: 1000,
        status: "ordered",
        purchasedAt: "2025-01-02T00:00:00.000Z",
        receivedAt: null,
        shippedAt: null,
        outOfStockAt: null,
        supplierName: null,
        unitCost: null,
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
    expect(restored.variants[0]!.priceOffset).toBeNull();
    expect(restored.variants[0]!.costOffset).toBeNull();
    expect(restored.variants[1]!.priceOffset).toBe(20);
    expect(restored.variants[1]!.costOffset).toBe(10);
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
  it("往返序列化應產生深度相等的物件（含明細）", () => {
    const original = createSampleOrder();
    const json = serializeOrder(original);
    const restored = deserializeOrder(json);
    expect(restored).toEqual(original);
  });

  it("明細項目的 null 欄位應正確保留", () => {
    const original = createSampleOrder();
    const json = serializeOrder(original);
    const restored = deserializeOrder(json);

    // 第一筆明細有 variantLabel，第二筆為 null
    expect(restored.items[0]!.variantLabel).toBe("紅 L");
    expect(restored.items[1]!.variantLabel).toBeNull();

    // 第二筆明細的 unitCost 為 null
    expect(restored.items[1]!.unitCost).toBeNull();
  });

  it("空明細項目的訂單往返序列化應正確", () => {
    const original: Order = {
      ...createSampleOrder(),
      items: [],
      totalAmount: 0,
    };
    const json = serializeOrder(original);
    const restored = deserializeOrder(json);
    expect(restored).toEqual(original);
    expect(restored.items).toEqual([]);
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
