/**
 * 資料模型統一匯出
 */

export { ACTIVE_STATUS, toActiveStatusKey } from "./active-status";
export type { ActiveStatusKey } from "./active-status";

export type {
  CreateCustomerInput,
  Customer,
  UpdateCustomerInput,
} from "./customer";

export type {
  CreateSupplierInput,
  Supplier,
  UpdateSupplierInput,
} from "./supplier";

export type {
  CreateProductOptionInput,
  CreateProductOptionValueInput,
  CreateProductInput,
  Product,
  ProductOption,
  ProductOptionValue,
  UpdateProductInput,
} from "./product";
export { deriveProductActiveState, PREORDER_STATUSES } from "./product";
export type { PreorderStatus } from "./product";

export type {
  ConfirmShipmentInput,
  CreateOrderInput,
  Order,
  OrderStatus,
  OrderFulfillmentStatus,
  PaginatedResult,
  PaymentStatus,
  SelectedOptionSnapshot,
  StatusChange,
  ValidationResult,
} from "./order";

export {
  isOrderFulfillmentStatus,
  isOrderStatus,
  isPaymentStatus,
  normalizeLegacyOrderStatus,
  normalizeOrderStatus,
  normalizePaymentStatus,
  ORDER_FULFILLMENT_STATUS_LABEL,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUSES,
} from "./order";

export type {
  Shipment,
  ShipmentStatus,
  ShipmentOrderSummary,
  CreateShipmentInput,
} from "./shipment";

export {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABEL,
  isShipmentStatus,
} from "./shipment";

export type { SupplierOrderSummary } from "./supplier-order-summary";

// ---------------------------------------------------------------------------
// Backward-compatibility aliases (model simplification migration)
// ---------------------------------------------------------------------------

/**
 * @deprecated OrderItem 已合併至 Order。此型別為 Order 的別名。
 */
export type { Order as OrderItem } from "./order";

/**
 * @deprecated 請使用 SelectedOptionSnapshot
 */
export type { SelectedOptionSnapshot as OrderItemSelectedOptionSnapshot } from "./order";

/**
 * @deprecated SplitAllocation 功能已移除
 */
export type SplitAllocation = { orderItemId: string; quantity: number };

import type { OrderFulfillmentStatus } from "./order";
import { ORDER_FULFILLMENT_STATUSES } from "./order";

/**
 * @deprecated OrderItem 狀態已改為 OrderFulfillmentStatus (大寫)。
 * 此處維持向下相容映射。
 */
export type OrderItemStatus = OrderFulfillmentStatus;

/**
 * @deprecated 請使用 ORDER_FULFILLMENT_STATUS_LABEL
 */
export const ORDER_ITEM_STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  ordered: "已採購",
  received: "已到貨",
  shipped: "已出貨",
  completed: "已完成",
  out_of_stock: "缺貨",
  cancelled: "已取消",
  PENDING: "待處理",
  ORDERED: "已採購",
  RECEIVED: "已到貨",
  SHIPPED: "已出貨",
  COMPLETED: "已完成",
  OUT_OF_STOCK: "缺貨",
  CANCELLED: "已取消",
};

/**
 * @deprecated 請使用 ORDER_FULFILLMENT_STATUSES
 */
export const ORDER_ITEM_STATUSES = ORDER_FULFILLMENT_STATUSES;

/**
 * @deprecated normalizeOrderItemStatus 已不再需要。
 * 此函式將 lowercase status 轉為 OrderFulfillmentStatus。
 */
export function normalizeOrderItemStatus(value: unknown): OrderFulfillmentStatus {
  if (typeof value !== "string") return "PENDING";
  const upper = value.toUpperCase();
  if ((ORDER_FULFILLMENT_STATUSES as readonly string[]).includes(upper)) {
    return upper as OrderFulfillmentStatus;
  }
  switch (value) {
    case "pending": return "PENDING";
    case "ordered": return "ORDERED";
    case "received": return "RECEIVED";
    case "shipped": return "SHIPPED";
    case "completed": return "COMPLETED";
    case "out_of_stock": return "OUT_OF_STOCK";
    case "cancelled": return "CANCELLED";
    default: return "PENDING";
  }
}

/**
 * @deprecated calculateOrderItemSubtotal 已被 calculateTotalPrice 取代
 */
export function calculateOrderItemSubtotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}
