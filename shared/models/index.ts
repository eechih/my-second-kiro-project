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
