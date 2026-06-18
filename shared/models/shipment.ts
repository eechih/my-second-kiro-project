/**
 * 出貨單（Shipment）及共用型別
 *
 * 需求：4.1, 8.4
 */

// ---------------------------------------------------------------------------
// 狀態型別
// ---------------------------------------------------------------------------

/** 出貨單狀態 */
export const SHIPMENT_STATUSES = [
  "PENDING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  PENDING: "待出貨",
  SHIPPED: "已出貨",
  DELIVERED: "已送達",
  CANCELLED: "已取消",
};

export function isShipmentStatus(value: unknown): value is ShipmentStatus {
  return (
    typeof value === "string" &&
    (SHIPMENT_STATUSES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// 出貨單（Shipment）
// ---------------------------------------------------------------------------

/** 出貨單 */
export interface Shipment {
  /** 唯一識別碼 */
  id: string;
  /** 出貨單號（遞增流水號，唯一） */
  shipmentNumber: string;
  /** 收件人姓名（max 100） */
  recipientName: string;
  /** 收件人電話（max 30） */
  recipientPhone: string | null;
  /** 收件地址（max 200） */
  recipientAddress: string | null;
  /** 出貨狀態 */
  status: ShipmentStatus;
  /** 物流方式（max 50） */
  shippingMethod: string | null;
  /** 追蹤碼（max 100） */
  trackingNumber: string | null;
  /** 實際物流成本（0–999,999） */
  actualShippingCost: number;
  /** ISO 8601 出貨時間 */
  shippedAt: string | null;
  /** ISO 8601 送達時間 */
  deliveredAt: string | null;
  /** ISO 8601 取消時間 */
  cancelledAt: string | null;
  /** 備註（max 500） */
  note: string | null;
  /** ISO 8601 建立時間 */
  createdAt: string;
  /** ISO 8601 更新時間 */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 查詢用摘要型別
// ---------------------------------------------------------------------------

/** 出貨單關聯的訂單摘要（查詢單筆 Shipment 時使用） */
export interface ShipmentOrderSummary {
  /** 訂單編號 */
  orderNumber: string;
  /** 客戶名稱快照 */
  customerNameSnapshot: string;
  /** 商品名稱快照 */
  productNameSnapshot: string;
  /** 數量 */
  quantity: number;
  /** 訂單總金額 */
  totalAmount: number;
}

// ---------------------------------------------------------------------------
// 輸入型別
// ---------------------------------------------------------------------------

/** 建立出貨單輸入 */
export interface CreateShipmentInput {
  /** 收件人姓名（必填，max 100） */
  recipientName: string;
  /** 收件人電話（選填，max 30） */
  recipientPhone?: string | null;
  /** 收件地址（選填，max 200） */
  recipientAddress?: string | null;
  /** 物流方式（選填，max 50） */
  shippingMethod?: string | null;
  /** 追蹤碼（選填，max 100） */
  trackingNumber?: string | null;
  /** 實際物流成本（選填，預設為 0，範圍 0–999,999） */
  actualShippingCost?: number;
  /** 備註（選填，max 500） */
  note?: string | null;
  /** 要包含在此出貨單的訂單 ID 列表（必填，1–50 筆） */
  orderIds: string[];
}
