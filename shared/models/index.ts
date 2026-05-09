/**
 * 資料模型統一匯出
 */

export type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customer";

export type {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
} from "./supplier";

export type {
  SpecDimension,
  ProductVariant,
  Product,
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
} from "./product";

export type {
  OrderStatus,
  LineItemStatus,
  StatusChange,
  ValidationResult,
  PaginatedResult,
  SplitAllocation,
  LineItem,
  Order,
  CreateLineItemInput,
  CreateOrderInput,
  ShipLineItemInput,
  SplitOrderInput,
} from "./order";
