/**
 * 序列化與反序列化工具函式
 *
 * 所有資料模型（Order、Product、Customer、Supplier）的 JSON 序列化/反序列化。
 * 確保往返（round-trip）一致性：serialize → deserialize 產生深度相等的物件。
 *
 * 需求：10.1, 10.2, 10.3, 10.4
 */

import type { Order, SelectedOptionSnapshot } from "../models/order";
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
  assertStringField(order, "customerNameSnapshot", "Order");
  assertStringField(order, "productId", "Order");
  assertStringField(order, "productNameSnapshot", "Order");
  assertNumberField(order, "quantity", "Order");
  assertNumberField(order, "unitPriceSnapshot", "Order");
  assertNumberField(order, "totalPriceSnapshot", "Order");
  assertNumberField(order, "totalAmount", "Order");
  assertStringField(order, "status", "Order");
  assertStringField(order, "createdAt", "Order");
  assertStringField(order, "updatedAt", "Order");
  assertOptionalNullableStringField(order, "paidAt", "Order");
  assertOptionalNullableStringField(order, "cancelledAt", "Order");
  assertOptionalNullableStringField(order, "refundedAt", "Order");
  assertOptionalNullableStringField(order, "completedAt", "Order");
  assertOptionalNullableStringField(order, "purchasedAt", "Order");
  assertOptionalNullableStringField(order, "receivedAt", "Order");
  assertOptionalNullableStringField(order, "shippedAt", "Order");
  assertOptionalNullableStringField(order, "outOfStockAt", "Order");
  assertArrayField(order, "statusHistory", "Order");

  // 處理 selectedOptionsSnapshot
  const rawOptions = order.selectedOptionsSnapshot;
  const selectedOptionsSnapshot: SelectedOptionSnapshot[] = Array.isArray(
    rawOptions,
  )
    ? rawOptions
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
        .map((entry) => deserializeSelectedOptionSnapshot(entry))
    : [];

  return {
    ...order,
    selectedOptionsSnapshot,
    customerPhoneSnapshot:
      order.customerPhoneSnapshot === undefined
        ? null
        : (order.customerPhoneSnapshot as string | null),
    customerEmailSnapshot:
      order.customerEmailSnapshot === undefined
        ? null
        : (order.customerEmailSnapshot as string | null),
    shippingAddressSnapshot:
      order.shippingAddressSnapshot === undefined
        ? null
        : (order.shippingAddressSnapshot as string | null),
    productImageUrlSnapshot:
      order.productImageUrlSnapshot === undefined
        ? null
        : (order.productImageUrlSnapshot as string | null),
    unitCostSnapshot:
      order.unitCostSnapshot === undefined
        ? null
        : (order.unitCostSnapshot as number | null),
    totalCostSnapshot:
      order.totalCostSnapshot === undefined
        ? null
        : (order.totalCostSnapshot as number | null),
    supplierName:
      order.supplierName === undefined
        ? null
        : (order.supplierName as string | null),
    purchasedAt:
      order.purchasedAt === undefined
        ? null
        : (order.purchasedAt as string | null),
    receivedAt:
      order.receivedAt === undefined
        ? null
        : (order.receivedAt as string | null),
    shippedAt:
      order.shippedAt === undefined ? null : (order.shippedAt as string | null),
    outOfStockAt:
      order.outOfStockAt === undefined
        ? null
        : (order.outOfStockAt as string | null),
    paidAt: order.paidAt === undefined ? null : (order.paidAt as string | null),
    cancelledAt:
      order.cancelledAt === undefined
        ? null
        : (order.cancelledAt as string | null),
    refundedAt:
      order.refundedAt === undefined
        ? null
        : (order.refundedAt as string | null),
    completedAt:
      order.completedAt === undefined
        ? null
        : (order.completedAt as string | null),
    note: order.note === undefined ? null : (order.note as string | null),
    shipmentId:
      order.shipmentId === undefined
        ? null
        : (order.shipmentId as string | null),
    statusHistory: order.statusHistory as Order["statusHistory"],
  } as Order;
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
  assertNumberField(product, "sequenceNumber", "Product");
  assertStringField(product, "description", "Product");
  assertNumberField(product, "price", "Product");
  assertNumberField(product, "cost", "Product");
  assertNumberField(product, "stockQuantity", "Product");
  assertBooleanField(product, "isActive", "Product");
  assertStringField(product, "createdAt", "Product");
  assertStringField(product, "updatedAt", "Product");
  assertArrayField(product, "options", "Product");
  assertArrayField(product, "imageUrls", "Product");

  if (
    product.defaultSupplierId !== undefined &&
    product.defaultSupplierId !== null &&
    typeof product.defaultSupplierId !== "string"
  ) {
    throw new Error(
      `反序列化失敗：Product.defaultSupplierId 應為 string 或 null，但收到 ${typeof product.defaultSupplierId}`,
    );
  }

  return {
    ...product,
    defaultSupplierId:
      product.defaultSupplierId === undefined
        ? null
        : (product.defaultSupplierId as string | null),
    options: product.options as Product["options"],
    imageUrls: product.imageUrls as Product["imageUrls"],
  } as Product;
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
  assertOptionalStringField(customer, "phone", "Customer");
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
  assertOptionalStringField(supplier, "phone", "Supplier");
  assertStringField(supplier, "email", "Supplier");
  assertStringField(supplier, "address", "Supplier");
  assertNullableStringField(supplier, "translationParser", "Supplier");
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

function assertOptionalStringField(
  obj: Record<string, unknown>,
  field: string,
  typeName: string,
): void {
  if (obj[field] !== undefined && typeof obj[field] !== "string") {
    throw new Error(
      `反序列化失敗：${typeName}.${field} 應為 string，但收到 ${typeof obj[field]}`,
    );
  }
}

function assertNullableStringField(
  obj: Record<string, unknown>,
  field: string,
  typeName: string,
): void {
  if (
    obj[field] !== undefined &&
    obj[field] !== null &&
    typeof obj[field] !== "string"
  ) {
    throw new Error(
      `反序列化失敗：${typeName}.${field} 應為 string 或 null，但收到 ${typeof obj[field]}`,
    );
  }
}

function assertOptionalNullableStringField(
  obj: Record<string, unknown>,
  field: string,
  typeName: string,
): void {
  if (
    obj[field] !== undefined &&
    obj[field] !== null &&
    typeof obj[field] !== "string"
  ) {
    throw new Error(
      `反序列化失敗：${typeName}.${field} 應為 string、null 或 undefined，但收到 ${typeof obj[field]}`,
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

function deserializeSelectedOptionSnapshot(
  raw: Record<string, unknown>,
): SelectedOptionSnapshot {
  assertStringField(raw, "optionName", "SelectedOptionSnapshot");
  assertStringField(raw, "valueName", "SelectedOptionSnapshot");
  assertNumberField(raw, "priceOffset", "SelectedOptionSnapshot");
  assertNumberField(raw, "costOffset", "SelectedOptionSnapshot");

  return {
    optionName: raw.optionName as string,
    valueName: raw.valueName as string,
    priceOffset: raw.priceOffset as number,
    costOffset: raw.costOffset as number,
  };
}
