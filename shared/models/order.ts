/**
 * 訂單（Order）、明細項目（LineItem）及共用型別
 *
 * 需求：4.1, 4.3, 4.4, 4.12, 4.13, 5.1, 6.1, 6.9
 */

// ---------------------------------------------------------------------------
// 狀態型別
// ---------------------------------------------------------------------------

/** 訂單狀態 */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipping",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** 明細項目狀態 */
export const LINE_ITEM_STATUSES = [
  "pending",
  "ordered",
  "received",
  "shipped",
  "out_of_stock",
] as const;

export type LineItemStatus = (typeof LINE_ITEM_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "待處理",
  confirmed: "已確認",
  shipping: "出貨中",
  completed: "已完成",
  cancelled: "已取消",
};

export const LINE_ITEM_STATUS_LABEL: Record<LineItemStatus, string> = {
  pending: "待處理",
  ordered: "已訂購",
  received: "已收到",
  shipped: "已出貨",
  out_of_stock: "缺貨",
};

const LEGACY_LINE_ITEM_STATUS_MAP: Record<string, LineItemStatus> = {
  待處理: "pending",
  已訂購: "ordered",
  已收到: "received",
  已出貨: "shipped",
  缺貨: "out_of_stock",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizeOrderStatus(value: unknown): OrderStatus {
  return isOrderStatus(value) ? value : "pending";
}

export function isLineItemStatus(value: unknown): value is LineItemStatus {
  return (
    typeof value === "string" &&
    (LINE_ITEM_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizeLineItemStatus(value: unknown): LineItemStatus {
  if (isLineItemStatus(value)) {
    return value;
  }

  if (typeof value === "string") {
    if (value in LEGACY_LINE_ITEM_STATUS_MAP) {
      return LEGACY_LINE_ITEM_STATUS_MAP[value]!;
    }
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
  lineItemId: string;
  /** 分配到第幾筆新訂單（0-based） */
  targetOrderIndex: number;
}

// ---------------------------------------------------------------------------
// 明細項目（LineItem）
// ---------------------------------------------------------------------------

/** 訂單明細項目 */
export interface LineItem {
  /** 唯一識別碼 */
  id: string;
  /** 商品 ID */
  productId: string;
  /** 商品名稱（反正規化） */
  productName: string;
  /** 規格組合顯示標籤（反正規化，如「黑 L」；無規格組合時為 null） */
  variantLabel: string | null;
  /** 訂購數量（> 0） */
  quantity: number;
  /** 單價（使用規格組合的有效單價） */
  unitPrice: number;
  /** 小計 = quantity × unitPrice */
  subtotal: number;
  /** 明細狀態 */
  status: LineItemStatus;
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
  lineItems: LineItem[];
  /** 訂單總金額 */
  totalAmount: number;
  /** 訂單狀態 */
  status: OrderStatus;
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
export interface CreateLineItemInput {
  /** 商品 ID（必填） */
  productId: string;
  /** 商品名稱（必填，反正規化） */
  productName: string;
  /** 規格組合顯示標籤（商品有規格組合時必填） */
  variantLabel?: string | null;
  /** 訂購數量（必填，> 0） */
  quantity: number;
  /** 單價（必填，>= 0） */
  unitPrice: number;
}

/** 建立訂單輸入 */
export interface CreateOrderInput {
  /** 客戶 ID（必填） */
  customerId: string;
  /** 客戶名稱（必填，反正規化） */
  customerName: string;
  /** 明細項目列表（必填，至少一筆） */
  lineItems: CreateLineItemInput[];
}

/** 確認出貨輸入 */
export interface ConfirmShipmentInput {
  /** 明細項目 ID（必填） */
  lineItemId: string;
}

/** 分拆訂單輸入 */
export interface SplitOrderInput {
  /** 原訂單 ID（必填） */
  orderId: string;
  /** 明細項目分配方式（必填） */
  allocations: SplitAllocation[];
}
