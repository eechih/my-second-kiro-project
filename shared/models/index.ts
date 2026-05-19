/**
 * 資料模型統一匯出
 */

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
  CreateProductInput,
  CreateVariantInput,
  Product,
  ProductVariant,
  UpdateProductInput,
  UpdateVariantInput,
} from "./product";

export type {
  ConfirmShipmentInput,
  CreateOrderItemInput,
  CreateOrderInput,
  OrderItem,
  OrderItemStatus,
  Order,
  OrderStatus,
  PaginatedResult,
  SplitAllocation,
  SplitOrderInput,
  StatusChange,
  ValidationResult,
} from "./order";

export {
  isOrderItemStatus,
  ORDER_ITEM_STATUS_LABEL,
  ORDER_ITEM_STATUSES,
  isOrderStatus,
  normalizeOrderItemStatus,
  normalizeOrderStatus,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
} from "./order";
