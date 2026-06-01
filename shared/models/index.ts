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
  CreateOrderItemInput,
  CreateOrderInput,
  FulfillmentStatus,
  OrderItem,
  OrderItemSelectedOptionSnapshot,
  OrderItemStatus,
  Order,
  OrderStatus,
  PaginatedResult,
  PaymentStatus,
  SplitAllocation,
  SplitOrderInput,
  StatusChange,
  ValidationResult,
} from "./order";

export {
  FULFILLMENT_STATUS_LABEL,
  FULFILLMENT_STATUSES,
  isFulfillmentStatus,
  isOrderItemStatus,
  ORDER_ITEM_STATUS_LABEL,
  ORDER_ITEM_STATUSES,
  isPaymentStatus,
  isOrderStatus,
  normalizeFulfillmentStatus,
  normalizeOrderItemStatus,
  normalizeOrderStatus,
  normalizePaymentStatus,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUSES,
} from "./order";
