/**
 * 訂單（Order）、明細項目（LineItem）、採購記錄（PurchaseRecord）及共用型別
 *
 * 需求：4.1, 4.3, 4.4, 4.12, 4.13, 5.1, 6.1, 6.9
 */

// ---------------------------------------------------------------------------
// 狀態型別
// ---------------------------------------------------------------------------

/** 訂單狀態 */
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled";

/** 明細項目狀態 */
export type LineItemStatus = "待處理" | "已訂購" | "已收到" | "已出貨" | "缺貨";

/** 採購記錄狀態 */
export type PurchaseRecordStatus = "pending" | "received" | "cancelled";

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
// 採購記錄（PurchaseRecord）
// ---------------------------------------------------------------------------

/** 採購記錄 */
export interface PurchaseRecord {
  /** 唯一識別碼 */
  id: string;
  /** 所屬明細項目 ID */
  lineItemId: string;
  /** 供應商 ID */
  supplierId: string;
  /** 供應商名稱（反正規化） */
  supplierName: string;
  /** 採購數量（> 0） */
  quantity: number;
  /** 單位成本（>= 0） */
  unitCost: number;
  /** 採購記錄狀態 */
  status: PurchaseRecordStatus;
  /** 狀態變更歷史 */
  statusHistory: StatusChange[];
  /** ISO 8601 採購日期 */
  purchasedAt: string;
  /** ISO 8601 入庫日期（尚未入庫時為 null） */
  receivedAt: string | null;
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
  /** 規格組合 ID（商品有規格組合時必填，無規格組合時為 null） */
  variantId: string | null;
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
  /** 累計已採購數量 */
  purchasedQuantity: number;
  /** 累計已出貨數量 */
  shippedQuantity: number;
  /** 採購記錄列表 */
  purchaseRecords: PurchaseRecord[];
  /** ISO 8601 訂購日期時間（尚未訂購時為 null） */
  orderedAt: string | null;
  /** ISO 8601 收到日期時間（尚未收到時為 null） */
  receivedAt: string | null;
  /** ISO 8601 出貨日期時間（尚未出貨時為 null） */
  shippedAt: string | null;
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
  /** 規格組合 ID（商品有規格組合時必填） */
  variantId?: string | null;
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

/** 建立採購記錄輸入 */
export interface CreatePurchaseRecordInput {
  /** 所屬明細項目 ID（必填） */
  lineItemId: string;
  /** 供應商 ID（必填） */
  supplierId: string;
  /** 供應商名稱（必填，反正規化） */
  supplierName: string;
  /** 採購數量（必填，> 0） */
  quantity: number;
  /** 單位成本（必填，>= 0） */
  unitCost: number;
}

/** 出貨操作輸入 */
export interface ShipLineItemInput {
  /** 訂單 ID（必填） */
  orderId: string;
  /** 明細項目 ID（必填） */
  lineItemId: string;
  /** 出貨數量（必填，> 0） */
  quantity: number;
}

/** 分拆訂單輸入 */
export interface SplitOrderInput {
  /** 原訂單 ID（必填） */
  orderId: string;
  /** 明細項目分配方式（必填） */
  allocations: SplitAllocation[];
}
