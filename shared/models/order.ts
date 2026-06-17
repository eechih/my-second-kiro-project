/**
 * 訂單（Order）、訂單明細（OrderItem）及共用型別
 *
 * 需求：4.1, 4.3, 4.4, 4.12, 4.13, 5.1, 6.1, 6.9
 */

// ---------------------------------------------------------------------------
// 狀態型別
// ---------------------------------------------------------------------------

/** 訂單狀態 */
export const ORDER_STATUSES = [
  "PENDING",
  "ORDERED",
  "RECEIVED",
  "SHIPPED",
  "COMPLETED",
  "OUT_OF_STOCK",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** 付款狀態 */
export const PAYMENT_STATUSES = [
  "UNPAID",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** 訂單明細狀態 */
export const ORDER_ITEM_STATUSES = [
  "pending",
  "ordered",
  "received",
  "shipped",
  "out_of_stock",
] as const;

export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "待處理",
  ORDERED: "已採購",
  RECEIVED: "已到貨",
  SHIPPED: "已出貨",
  COMPLETED: "已完成",
  OUT_OF_STOCK: "缺貨",
  CANCELLED: "已取消",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "未付款",
  PAID: "已付款",
  REFUNDED: "已退款",
  PARTIALLY_REFUNDED: "部分退款",
};

export const ORDER_ITEM_STATUS_LABEL: Record<OrderItemStatus, string> = {
  pending: "待處理",
  ordered: "已訂購",
  received: "已收到",
  shipped: "已出貨",
  out_of_stock: "缺貨",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizeOrderStatus(value: unknown): OrderStatus {
  if (isOrderStatus(value)) {
    return value;
  }

  switch (value) {
    case "pending":
    case "PENDING_PAYMENT":
      return "PENDING";
    case "PAID":
    case "confirmed":
      return "ORDERED";
    case "READY_TO_SHIP":
    case "PARTIALLY_RECEIVED":
    case "received":
      return "RECEIVED";
    case "PARTIALLY_SHIPPED":
    case "SHIPPED":
    case "shipping":
      return "SHIPPED";
    case "COMPLETED":
    case "completed":
      return "COMPLETED";
    case "OUT_OF_STOCK":
    case "out_of_stock":
      return "OUT_OF_STOCK";
    case "CANCELLED":
    case "cancelled":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

export function normalizeLegacyOrderStatus(input: {
  status: unknown;
  fulfillmentStatus?: unknown;
  cancelledAt?: unknown;
}): OrderStatus {
  if (input.cancelledAt) {
    return "CANCELLED";
  }

  if (typeof input.fulfillmentStatus === "string") {
    switch (input.fulfillmentStatus) {
      case "READY_TO_SHIP":
        return "RECEIVED";
      case "SHIPPED":
      case "PARTIALLY_SHIPPED":
        return "SHIPPED";
      case "COMPLETED":
        return "COMPLETED";
      default:
        break;
    }
  }

  return normalizeOrderStatus(input.status);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    (PAYMENT_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  if (isPaymentStatus(value)) {
    return value;
  }

  switch (value) {
    case "pending":
      return "UNPAID";
    case "confirmed":
    case "shipping":
    case "completed":
      return "PAID";
    case "refunded":
      return "REFUNDED";
    default:
      return "UNPAID";
  }
}

export function isOrderItemStatus(value: unknown): value is OrderItemStatus {
  return (
    typeof value === "string" &&
    (ORDER_ITEM_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizeOrderItemStatus(value: unknown): OrderItemStatus {
  if (isOrderItemStatus(value)) {
    return value;
  }
  return "pending";
}

// ---------------------------------------------------------------------------
// 共用型別
// ---------------------------------------------------------------------------

/** 狀態變更歷史記錄 */
export interface StatusChange {
  /** 先前狀態 */
  fromStatus: string;
  /** 新狀態 */
  toStatus: string;
  /** ISO 8601 變更時間戳記 */
  changedAt: string;
}

/** 驗證結果 */
export interface ValidationResult {
  /** 驗證是否通過 */
  valid: boolean;
  /** 驗證失敗時的錯誤訊息 */
  error?: string;
}

/** 分頁查詢結果 */
export interface PaginatedResult<T> {
  /** 當前頁面的項目列表 */
  items: T[];
  /** 總項目數量 */
  totalCount: number;
  /** 下一頁的分頁 token（無下一頁時為 undefined） */
  nextToken?: string;
}

/** 訂單分拆分配方式 */
export interface SplitAllocation {
  /** 明細項目 ID */
  orderItemId: string;
  /** 分配到第幾筆新訂單（0-based） */
  targetOrderIndex: number;
}

/** 訂單明細中單一規格選取快照 */
export interface OrderItemSelectedOptionSnapshot {
  optionName: string;
  valueName: string;
  priceOffset: number;
  costOffset: number;
}

// ---------------------------------------------------------------------------
// 訂單明細（OrderItem）
// ---------------------------------------------------------------------------

/** 訂單明細項目 */
export interface OrderItem {
  /** 唯一識別碼 */
  id: string;
  /** 商品 ID */
  productId: string;
  /** 商品名稱（反正規化） */
  productName: string;
  /** 商品圖片（反正規化） */
  productImageUrl: string | null;
  /** 商品 SKU（反正規化） */
  productSku?: string;
  /** 規格組合顯示標籤（反正規化，如「黑 L」；無規格組合時為 null） */
  variantLabel: string | null;
  /** 下單當下選取的規格值快照 */
  selectedOptionsSnapshot: OrderItemSelectedOptionSnapshot[];
  /** 訂購數量（> 0） */
  quantity: number;
  /** 單價（使用規格組合的有效單價） */
  unitPrice: number;
  /** 單位成本快照 */
  unitCostSnapshot: number | null;
  /** 小計 = quantity × unitPrice */
  subtotal: number;
  /** 總成本快照 */
  totalCostSnapshot: number | null;
  /** 明細狀態 */
  status: OrderItemStatus;
  /** ISO 8601 採購日期時間（尚未採購時為 null） */
  purchasedAt: string | null;
  /** ISO 8601 收到日期時間（尚未收到時為 null） */
  receivedAt: string | null;
  /** ISO 8601 出貨日期時間（尚未出貨時為 null） */
  shippedAt: string | null;
  /** ISO 8601 缺貨日期時間（尚未缺貨時為 null） */
  outOfStockAt: string | null;

  // --- 採購核心數據 ---
  /** 供應商名稱（反正規化，尚未採購時為 null） */
  supplierName: string | null;
  /** 採購單位成本（尚未採購時為 null） */
  unitCost: number | null;
}

// ---------------------------------------------------------------------------
// 訂單（Order）
// ---------------------------------------------------------------------------

/** 訂單 */
export interface Order {
  /** 唯一識別碼 */
  id: string;
  /** 訂單編號（系統自動產生，唯一） */
  orderNumber: string;
  /** 客戶 ID（必填） */
  customerId: string;
  /** 客戶名稱（反正規化，方便列表顯示） */
  customerName: string;
  /** 明細項目列表 */
  items: OrderItem[];
  /** 訂單總金額 */
  totalAmount: number;
  /** 訂單狀態 */
  status: OrderStatus;
  /** 付款狀態 */
  paymentStatus: PaymentStatus;
  /** ISO 8601 付款時間 */
  paidAt: string | null;
  /** ISO 8601 取消時間 */
  cancelledAt: string | null;
  /** ISO 8601 退款時間 */
  refundedAt: string | null;
  /** ISO 8601 完成時間 */
  completedAt: string | null;
  /** 狀態變更歷史 */
  statusHistory: StatusChange[];
  /** ISO 8601 建立時間 */
  createdAt: string;
  /** ISO 8601 更新時間 */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 輸入型別
// ---------------------------------------------------------------------------

/** 建立訂單明細項目輸入 */
export interface CreateOrderItemInput {
  /** 商品 ID（必填） */
  productId: string;
  /** 商品名稱（必填，反正規化） */
  productName: string;
  /** 商品 SKU（必填，反正規化） */
  productSku: string;
  /** 商品圖片（反正規化） */
  productImageUrl?: string | null;
  /** 規格組合顯示標籤（商品有規格組合時必填） */
  variantLabel?: string | null;
  /** 下單當下選取的規格值快照 */
  selectedOptionsSnapshot?: OrderItemSelectedOptionSnapshot[];
  /** 訂購數量（必填，> 0） */
  quantity: number;
  /** 單價（必填，>= 0） */
  unitPrice: number;
  /** 單位成本（選填） */
  unitCost?: number | null;
}

/** 建立訂單輸入 */
export interface CreateOrderInput {
  /** 客戶 ID（必填） */
  customerId: string;
  /** 客戶名稱（必填，反正規化） */
  customerName: string;
  /** 明細項目列表（必填，至少一筆） */
  orderItems: CreateOrderItemInput[];
}

/** 確認出貨輸入 */
export interface ConfirmShipmentInput {
  /** 明細項目 ID（必填） */
  orderItemId: string;
}

/** 分拆訂單輸入 */
export interface SplitOrderInput {
  /** 原訂單 ID（必填） */
  orderId: string;
  /** 明細項目分配方式（必填） */
  allocations: SplitAllocation[];
}
