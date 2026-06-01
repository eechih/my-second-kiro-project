/**
 * 序列化與反序列化工具函式
 *
 * 所有資料模型（Order、Product、Customer、Supplier）的 JSON 序列化/反序列化。
 * 確保往返（round-trip）一致性：serialize → deserialize 產生深度相等的物件。
 *
 * 需求：10.1, 10.2, 10.3, 10.4
 */

import type {
  Order,
  OrderItem,
  OrderItemSelectedOptionSnapshot,
} from "../models/order";
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
  assertOptionalNullableStringField(order, "paidAt", "Order");
  assertOptionalNullableStringField(order, "cancelledAt", "Order");
  assertOptionalNullableStringField(order, "refundedAt", "Order");
  assertOptionalNullableStringField(order, "completedAt", "Order");
  const rawItems = order.items ?? order.orderItems;
  if (!Array.isArray(rawItems)) {
    throw new Error("反序列化失敗：Order.items 應為 array");
  }
  assertArrayField(order, "statusHistory", "Order");

  return {
    ...order,
    items: rawItems.map(deserializeOrderItem),
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

function deserializeOrderItem(raw: unknown): OrderItem {
  assertIsObject(raw, "OrderItem");

  const item = raw as Record<string, unknown>;

  assertStringField(item, "id", "OrderItem");
  assertStringField(item, "productId", "OrderItem");
  assertStringField(item, "productName", "OrderItem");
  assertNumberField(item, "quantity", "OrderItem");
  assertNumberField(item, "unitPrice", "OrderItem");
  assertNumberField(item, "subtotal", "OrderItem");
  assertStringField(item, "status", "OrderItem");
  assertNullableStringField(item, "variantLabel", "OrderItem");
  assertNullableStringField(item, "productImageUrl", "OrderItem");
  assertNullableStringField(item, "purchasedAt", "OrderItem");
  assertNullableStringField(item, "receivedAt", "OrderItem");
  assertNullableStringField(item, "shippedAt", "OrderItem");
  assertNullableStringField(item, "outOfStockAt", "OrderItem");
  assertNullableStringField(item, "supplierName", "OrderItem");

  if (
    item.unitCost !== undefined &&
    item.unitCost !== null &&
    typeof item.unitCost !== "number"
  ) {
    throw new Error(
      `反序列化失敗：OrderItem.unitCost 應為 number 或 null，但收到 ${typeof item.unitCost}`,
    );
  }

  if (
    item.unitCostSnapshot !== undefined &&
    item.unitCostSnapshot !== null &&
    typeof item.unitCostSnapshot !== "number"
  ) {
    throw new Error(
      `反序列化失敗：OrderItem.unitCostSnapshot 應為 number 或 null，但收到 ${typeof item.unitCostSnapshot}`,
    );
  }

  if (
    item.totalCostSnapshot !== undefined &&
    item.totalCostSnapshot !== null &&
    typeof item.totalCostSnapshot !== "number"
  ) {
    throw new Error(
      `反序列化失敗：OrderItem.totalCostSnapshot 應為 number 或 null，但收到 ${typeof item.totalCostSnapshot}`,
    );
  }

  const selectedOptionsSnapshot = Array.isArray(item.selectedOptionsSnapshot)
    ? item.selectedOptionsSnapshot
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
        .map((entry) => deserializeSelectedOptionSnapshot(entry))
    : [];

  return {
    ...item,
    productImageUrl:
      item.productImageUrl === undefined
        ? null
        : (item.productImageUrl as string | null),
    variantLabel:
      item.variantLabel === undefined
        ? null
        : (item.variantLabel as string | null),
    selectedOptionsSnapshot,
    unitCostSnapshot:
      item.unitCostSnapshot === undefined
        ? null
        : (item.unitCostSnapshot as number | null),
    totalCostSnapshot:
      item.totalCostSnapshot === undefined
        ? null
        : (item.totalCostSnapshot as number | null),
    purchasedAt:
      item.purchasedAt === undefined
        ? null
        : (item.purchasedAt as string | null),
    receivedAt:
      item.receivedAt === undefined ? null : (item.receivedAt as string | null),
    shippedAt:
      item.shippedAt === undefined ? null : (item.shippedAt as string | null),
    outOfStockAt:
      item.outOfStockAt === undefined
        ? null
        : (item.outOfStockAt as string | null),
    supplierName:
      item.supplierName === undefined
        ? null
        : (item.supplierName as string | null),
    unitCost:
      item.unitCost === undefined ? null : (item.unitCost as number | null),
  } as OrderItem;
}

function deserializeSelectedOptionSnapshot(
  raw: Record<string, unknown>,
): OrderItemSelectedOptionSnapshot {
  assertStringField(raw, "optionName", "OrderItemSelectedOptionSnapshot");
  assertStringField(raw, "valueName", "OrderItemSelectedOptionSnapshot");
  assertNumberField(raw, "priceOffset", "OrderItemSelectedOptionSnapshot");
  assertNumberField(raw, "costOffset", "OrderItemSelectedOptionSnapshot");

  return {
    optionName: raw.optionName as string,
    valueName: raw.valueName as string,
    priceOffset: raw.priceOffset as number,
    costOffset: raw.costOffset as number,
  };
}
