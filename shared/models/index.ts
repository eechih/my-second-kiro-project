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
  CreateLineItemInput,
  CreateOrderItemInput,
  CreateOrderInput,
  LineItem,
  LineItemStatus,
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
  isLineItemStatus,
  ORDER_ITEM_STATUS_LABEL,
  isOrderStatus,
  LINE_ITEM_STATUS_LABEL,
  LINE_ITEM_STATUSES,
  normalizeOrderItemStatus,
  normalizeLineItemStatus,
  normalizeOrderStatus,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
} from "./order";
