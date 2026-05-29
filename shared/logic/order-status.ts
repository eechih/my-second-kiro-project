/**
 * 訂單狀態轉換驗證與自動推導
 *
 * 允許路徑：
 *   PENDING_PAYMENT → PAID → COMPLETED
 *   PENDING_PAYMENT / PAID / COMPLETED → CANCELLED 或 REFUNDED（依規則）
 *
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：5.1, 5.2, 5.3, 5.5, 5.6
 */

import type {
  FulfillmentStatus,
  OrderItem,
  OrderStatus,
  PaymentStatus,
} from "../models/order";

/**
 * 合法的訂單狀態轉換對照表。
 * key 為來源狀態，value 為該狀態可轉換至的目標狀態集合。
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  PENDING_PAYMENT: new Set<OrderStatus>(["PAID", "CANCELLED"]),
  PAID: new Set<OrderStatus>(["COMPLETED", "REFUNDED", "CANCELLED"]),
  CANCELLED: new Set<OrderStatus>([]),
  REFUNDED: new Set<OrderStatus>([]),
  COMPLETED: new Set<OrderStatus>(["REFUNDED"]),
};

/**
 * 驗證訂單狀態轉換是否合法。
 *
 * @param from - 目前訂單狀態
 * @param to - 目標訂單狀態
 * @returns 若轉換合法回傳 `true`，否則回傳 `false`
 */
export function isValidOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.has(to);
}

/**
 * 取得指定訂單狀態可轉換至的所有合法目標狀態。
 *
 * @param current - 目前訂單狀態
 * @returns 可轉換至的目標狀態陣列
 */
export function getNextAllowedOrderStatuses(
  current: OrderStatus,
): OrderStatus[] {
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed) {
    return [];
  }
  return [...allowed];
}

/**
 * 依明細項目狀態自動推導訂單應有的狀態。
 *
 * 規則：
 * - 若所有明細項目狀態皆為 shipped → COMPLETED
 * - 若至少一筆明細已 shipped → SHIPPED
 * - 若至少一筆明細已 received → READY_TO_SHIP
 * - 其他情況 → UNFULFILLED
 *
 * 注意：此函式僅根據明細狀態推導建議的訂單狀態，不處理 cancelled 等特殊情況。
 * 呼叫端應自行判斷是否套用推導結果（例如已取消的訂單不應被自動推導覆蓋）。
 *
 * @param orderItems - 訂單的明細項目列表
 * @returns 推導的訂單狀態，或 `null` 表示不需自動變更
 *
 * 需求：5.5, 5.6
 */
export function deriveFulfillmentStatusFromOrderItems(
  orderItems: ReadonlyArray<Pick<OrderItem, "status">>,
): FulfillmentStatus {
  if (orderItems.length === 0) {
    return "UNFULFILLED";
  }

  const allShipped = orderItems.every((item) => item.status === "shipped");
  const someShipped = orderItems.some((item) => item.status === "shipped");
  const someReceived = orderItems.some((item) => item.status === "received");

  if (allShipped) {
    return "COMPLETED";
  }

  if (someShipped) {
    return "SHIPPED";
  }

  if (someReceived) {
    return "READY_TO_SHIP";
  }

  return "UNFULFILLED";
}

export function deriveOrderStatusFromSummary(input: {
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  cancelledAt?: string | null;
}): OrderStatus {
  if (input.cancelledAt) {
    return "CANCELLED";
  }

  if (
    input.paymentStatus === "REFUNDED" ||
    input.paymentStatus === "PARTIALLY_REFUNDED"
  ) {
    return "REFUNDED";
  }

  if (input.paymentStatus === "UNPAID") {
    return "PENDING_PAYMENT";
  }

  if (input.fulfillmentStatus === "COMPLETED") {
    return "COMPLETED";
  }

  return "PAID";
}
