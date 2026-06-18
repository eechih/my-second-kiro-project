/**
 * 訂單（Order）模型定義
 *
 * 簡化後的 Order 模型：一筆訂單 = 一個商品規格，
 * 不再有獨立的 OrderItem 實體。
 *
 * 需求：1.1, 2.1, 2.2
 */

// ---------------------------------------------------------------------------
// 狀態型別
// ---------------------------------------------------------------------------

/** 訂單履約狀態 */
export const ORDER_FULFILLMENT_STATUSES = [
  "PENDING",
  "ORDERED",
  "RECEIVED",
  "SHIPPED",
  "COMPLETED",
  "OUT_OF_STOCK",
  "CANCELLED",
] as const;

export type OrderFulfillmentStatus =
  (typeof ORDER_FULFILLMENT_STATUSES)[number];

/**
 * @deprecated 請使用 OrderFulfillmentStatus
 * 保留向下相容別名，後續版本將移除
 */
export type OrderStatus = OrderFulfillmentStatus;

/**
 * @deprecated 請使用 ORDER_FULFILLMENT_STATUSES
 */
export const ORDER_STATUSES = ORDER_FULFILLMENT_STATUSES;

/** 付款狀態 */
export const PAYMENT_STATUSES = [
  "UNPAID",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_FULFILLMENT_STATUS_LABEL: Record<
  OrderFulfillmentStatus,
  string
> = {
  PENDING: "待處理",
  ORDERED: "已採購",
  RECEIVED: "已到貨",
  SHIPPED: "已出貨",
  COMPLETED: "已完成",
  OUT_OF_STOCK: "缺貨",
  CANCELLED: "已取消",
};

/**
 * @deprecated 請使用 ORDER_FULFILLMENT_STATUS_LABEL
 */
export const ORDER_STATUS_LABEL = ORDER_FULFILLMENT_STATUS_LABEL;

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "未付款",
  PAID: "已付款",
  REFUNDED: "已退款",
  PARTIALLY_REFUNDED: "部分退款",
};

export function isOrderFulfillmentStatus(
  value: unknown,
): value is OrderFulfillmentStatus {
  return (
    typeof value === "string" &&
    (ORDER_FULFILLMENT_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * @deprecated 請使用 isOrderFulfillmentStatus
 */
export const isOrderStatus = isOrderFulfillmentStatus;

export function normalizeOrderStatus(value: unknown): OrderFulfillmentStatus {
  if (isOrderFulfillmentStatus(value)) {
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
}): OrderFulfillmentStatus {
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

/** 訂單中單一規格選取快照 */
export interface SelectedOptionSnapshot {
  optionName: string;
  valueName: string;
  priceOffset: number;
  costOffset: number;
}

/**
 * @deprecated 請使用 SelectedOptionSnapshot
 */
export type OrderItemSelectedOptionSnapshot = SelectedOptionSnapshot;

// ---------------------------------------------------------------------------
// 訂單（Order）— 扁平化結構
// ---------------------------------------------------------------------------

/** 訂單 */
export interface Order {
  /** 唯一識別碼 */
  id: string;
  /** 訂單編號（系統自動產生，格式 ORD-YYYYMMDD-XXXX，唯一） */
  orderNumber: string;

  // --- 客戶快照 ---
  /** 客戶 ID（必填） */
  customerId: string;
  /** 客戶名稱快照 */
  customerNameSnapshot: string;
  /** 客戶電話快照 */
  customerPhoneSnapshot: string | null;
  /** 客戶 Email 快照 */
  customerEmailSnapshot: string | null;
  /** 收件地址快照 */
  shippingAddressSnapshot: string | null;

  // --- 商品快照 ---
  /** 商品 ID */
  productId: string;
  /** 商品名稱快照 */
  productNameSnapshot: string;
  /** 商品 SKU 快照 */
  productSkuSnapshot: string;
  /** 商品圖片快照 */
  productImageUrlSnapshot: string | null;
  /** 規格選取快照陣列 */
  selectedOptionsSnapshot: SelectedOptionSnapshot[];

  // --- 數量與金額 ---
  /** 數量（1–9999） */
  quantity: number;
  /** 單價快照（0–999,999,999） */
  unitPriceSnapshot: number;
  /** 單位成本快照（0–999,999,999，可為 null） */
  unitCostSnapshot: number | null;
  /** 總價快照 = quantity × unitPriceSnapshot */
  totalPriceSnapshot: number;
  /** 總成本快照 = quantity × unitCostSnapshot（unitCostSnapshot 為 null 時亦為 null） */
  totalCostSnapshot: number | null;
  /** 小計 = totalPriceSnapshot */
  subtotalAmount: number;
  /** 運費（0–999,999,999） */
  shippingAmount: number;
  /** 折扣（0–999,999,999，≤ subtotal + shipping） */
  discountAmount: number;
  /** 總金額 = subtotal + shipping - discount */
  totalAmount: number;

  // --- 狀態 ---
  /** 訂單履約狀態 */
  status: OrderFulfillmentStatus;
  /** 付款狀態 */
  paymentStatus: PaymentStatus;

  // --- 採購與物流 ---
  /** 供應商名稱 */
  supplierName: string | null;
  /** ISO 8601 採購時間 */
  purchasedAt: string | null;
  /** ISO 8601 入庫時間 */
  receivedAt: string | null;
  /** ISO 8601 出貨時間 */
  shippedAt: string | null;
  /** ISO 8601 缺貨時間 */
  outOfStockAt: string | null;

  // --- 付款與終態時間 ---
  /** ISO 8601 付款時間 */
  paidAt: string | null;
  /** ISO 8601 取消時間 */
  cancelledAt: string | null;
  /** ISO 8601 退款時間 */
  refundedAt: string | null;
  /** ISO 8601 完成時間 */
  completedAt: string | null;

  // --- 備註與歷史 ---
  /** 備註（最大 500 字元） */
  note: string | null;
  /** 狀態變更歷史 */
  statusHistory: StatusChange[];

  // --- 出貨單關聯 ---
  /** 關聯的 Shipment ID */
  shipmentId: string | null;

  // --- 系統欄位 ---
  /** 啟用旗標 */
  isActive: boolean;
  /** ISO 8601 建立時間 */
  createdAt: string;
  /** ISO 8601 更新時間 */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 輸入型別
// ---------------------------------------------------------------------------

/** 建立訂單輸入（扁平結構） */
export interface CreateOrderInput {
  // --- 客戶資訊 ---
  /** 客戶 ID（必填） */
  customerId: string;
  /** 客戶名稱快照（必填） */
  customerNameSnapshot: string;
  /** 客戶電話快照 */
  customerPhoneSnapshot?: string | null;
  /** 客戶 Email 快照 */
  customerEmailSnapshot?: string | null;
  /** 收件地址快照 */
  shippingAddressSnapshot?: string | null;

  // --- 商品資訊 ---
  /** 商品 ID（必填） */
  productId: string;
  /** 商品名稱快照（必填） */
  productNameSnapshot: string;
  /** 商品 SKU 快照（必填） */
  productSkuSnapshot: string;
  /** 商品圖片快照 */
  productImageUrlSnapshot?: string | null;
  /** 規格選取快照 */
  selectedOptionsSnapshot?: SelectedOptionSnapshot[];

  // --- 數量與金額 ---
  /** 數量（必填，1–9999） */
  quantity: number;
  /** 單價快照（必填，0–999,999,999） */
  unitPriceSnapshot: number;
  /** 單位成本快照（選填） */
  unitCostSnapshot?: number | null;
  /** 運費（選填，預設 0） */
  shippingAmount?: number;
  /** 折扣（選填，預設 0） */
  discountAmount?: number;

  // --- 其他 ---
  /** 備註 */
  note?: string | null;
}

/** 確認出貨輸入（單筆 Order 直接出貨，無 Shipment 情境） */
export interface ConfirmShipmentInput {
  /** 訂單 ID（必填） */
  orderId: string;
}
