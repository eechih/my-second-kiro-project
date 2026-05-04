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
  PurchaseRecordStatus,
  StatusChange,
  ValidationResult,
  PaginatedResult,
  SplitAllocation,
  PurchaseRecord,
  LineItem,
  Order,
  CreateLineItemInput,
  CreateOrderInput,
  CreatePurchaseRecordInput,
  ShipLineItemInput,
  SplitOrderInput,
} from "./order";
