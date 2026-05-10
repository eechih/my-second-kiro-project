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
  CreateOrderInput,
  LineItem,
  LineItemStatus,
  Order,
  OrderStatus,
  PaginatedResult,
  SplitAllocation,
  SplitOrderInput,
  StatusChange,
  ValidationResult,
} from "./order";

export {
  isLineItemStatus,
  isOrderStatus,
  LINE_ITEM_STATUS_LABEL,
  LINE_ITEM_STATUSES,
  normalizeLineItemStatus,
  normalizeOrderStatus,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
} from "./order";
