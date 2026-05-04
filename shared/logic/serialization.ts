/**
 * 序列化與反序列化工具函式
 *
 * 所有資料模型（Order、Product、Customer、Supplier）的 JSON 序列化/反序列化。
 * 確保往返（round-trip）一致性：serialize → deserialize 產生深度相等的物件。
 *
 * 需求：10.1, 10.2, 10.3, 10.4
 */

import type { Order } from "../models/order";
import type { Product } from "../models/product";
import type { Customer } from "../models/customer";
import type { Supplier } from "../models/supplier";

// ---------------------------------------------------------------------------
// Order 序列化 / 反序列化
// ---------------------------------------------------------------------------

/** 將 Order 物件序列化為 JSON 字串 */
export function serializeOrder(order: Order): string {
  return JSON.stringify(order);
}

/** 將 JSON 字串反序列化為 Order 物件 */
export function deserializeOrder(json: string): Order {
  const parsed: unknown = JSON.parse(json);
  assertIsObject(parsed, "Order");

  const order = parsed as Record<string, unknown>;

  // 驗證必要的頂層欄位存在
  assertStringField(order, "id", "Order");
  assertStringField(order, "orderNumber", "Order");
  assertStringField(order, "customerId", "Order");
  assertStringField(order, "customerName", "Order");
  assertNumberField(order, "totalAmount", "Order");
  assertStringField(order, "status", "Order");
  assertStringField(order, "createdAt", "Order");
  assertStringField(order, "updatedAt", "Order");
  assertArrayField(order, "lineItems", "Order");
  assertArrayField(order, "statusHistory", "Order");

  return parsed as unknown as Order;
}

// ---------------------------------------------------------------------------
// Product 序列化 / 反序列化
// ---------------------------------------------------------------------------

/** 將 Product 物件序列化為 JSON 字串 */
export function serializeProduct(product: Product): string {
  return JSON.stringify(product);
}

/** 將 JSON 字串反序列化為 Product 物件 */
export function deserializeProduct(json: string): Product {
  const parsed: unknown = JSON.parse(json);
  assertIsObject(parsed, "Product");

  const product = parsed as Record<string, unknown>;

  assertStringField(product, "id", "Product");
  assertStringField(product, "name", "Product");
  assertStringField(product, "sku", "Product");
  assertNumberField(product, "unitPrice", "Product");
  assertNumberField(product, "defaultCost", "Product");
  assertNumberField(product, "stockQuantity", "Product");
  assertNumberField(product, "version", "Product");
  assertBooleanField(product, "isActive", "Product");
  assertStringField(product, "createdAt", "Product");
  assertStringField(product, "updatedAt", "Product");
  assertArrayField(product, "specDimensions", "Product");
  assertArrayField(product, "variants", "Product");
  assertArrayField(product, "imageUrls", "Product");

  return parsed as unknown as Product;
}

// ---------------------------------------------------------------------------
// Customer 序列化 / 反序列化
// ---------------------------------------------------------------------------

/** 將 Customer 物件序列化為 JSON 字串 */
export function serializeCustomer(customer: Customer): string {
  return JSON.stringify(customer);
}

/** 將 JSON 字串反序列化為 Customer 物件 */
export function deserializeCustomer(json: string): Customer {
  const parsed: unknown = JSON.parse(json);
  assertIsObject(parsed, "Customer");

  const customer = parsed as Record<string, unknown>;

  assertStringField(customer, "id", "Customer");
  assertStringField(customer, "name", "Customer");
  assertStringField(customer, "contactPerson", "Customer");
  assertStringField(customer, "phone", "Customer");
  assertStringField(customer, "email", "Customer");
  assertStringField(customer, "address", "Customer");
  assertBooleanField(customer, "isActive", "Customer");
  assertStringField(customer, "createdAt", "Customer");
  assertStringField(customer, "updatedAt", "Customer");

  return parsed as unknown as Customer;
}

// ---------------------------------------------------------------------------
// Supplier 序列化 / 反序列化
// ---------------------------------------------------------------------------

/** 將 Supplier 物件序列化為 JSON 字串 */
export function serializeSupplier(supplier: Supplier): string {
  return JSON.stringify(supplier);
}

/** 將 JSON 字串反序列化為 Supplier 物件 */
export function deserializeSupplier(json: string): Supplier {
  const parsed: unknown = JSON.parse(json);
  assertIsObject(parsed, "Supplier");

  const supplier = parsed as Record<string, unknown>;

  assertStringField(supplier, "id", "Supplier");
  assertStringField(supplier, "name", "Supplier");
  assertStringField(supplier, "contactPerson", "Supplier");
  assertStringField(supplier, "phone", "Supplier");
  assertStringField(supplier, "email", "Supplier");
  assertStringField(supplier, "address", "Supplier");
  assertBooleanField(supplier, "isActive", "Supplier");
  assertStringField(supplier, "createdAt", "Supplier");
  assertStringField(supplier, "updatedAt", "Supplier");

  return parsed as unknown as Supplier;
}

// ---------------------------------------------------------------------------
// 內部驗證輔助函式
// ---------------------------------------------------------------------------

function assertIsObject(
  value: unknown,
  typeName: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `反序列化失敗：預期 ${typeName} 為物件，但收到 ${typeof value}`,
    );
  }
}

function assertStringField(
  obj: Record<string, unknown>,
  field: string,
  typeName: string,
): void {
  if (typeof obj[field] !== "string") {
    throw new Error(
      `反序列化失敗：${typeName}.${field} 應為 string，但收到 ${typeof obj[field]}`,
    );
  }
}

function assertNumberField(
  obj: Record<string, unknown>,
  field: string,
  typeName: string,
): void {
  if (typeof obj[field] !== "number") {
    throw new Error(
      `反序列化失敗：${typeName}.${field} 應為 number，但收到 ${typeof obj[field]}`,
    );
  }
}

function assertBooleanField(
  obj: Record<string, unknown>,
  field: string,
  typeName: string,
): void {
  if (typeof obj[field] !== "boolean") {
    throw new Error(
      `反序列化失敗：${typeName}.${field} 應為 boolean，但收到 ${typeof obj[field]}`,
    );
  }
}

function assertArrayField(
  obj: Record<string, unknown>,
  field: string,
  typeName: string,
): void {
  if (!Array.isArray(obj[field])) {
    throw new Error(
      `反序列化失敗：${typeName}.${field} 應為 array，但收到 ${typeof obj[field]}`,
    );
  }
}
