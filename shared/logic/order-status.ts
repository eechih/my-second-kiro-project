/**
 * 訂單履約狀態轉換驗證
 *
 * 需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import type { OrderFulfillmentStatus } from "../models/order";

/**
 * 訂單履約狀態允許的轉換路徑
 *
 * - PENDING → ORDERED, OUT_OF_STOCK, CANCELLED
 * - ORDERED → RECEIVED, OUT_OF_STOCK, CANCELLED
 * - RECEIVED → SHIPPED, CANCELLED
 * - SHIPPED → COMPLETED
 * - OUT_OF_STOCK → CANCELLED
 * - COMPLETED → (終態)
 * - CANCELLED → (終態)
 */
export const ALLOWED_TRANSITIONS: Record<
  OrderFulfillmentStatus,
  ReadonlySet<OrderFulfillmentStatus>
> = {
  PENDING: new Set<OrderFulfillmentStatus>([
    "ORDERED",
    "OUT_OF_STOCK",
    "CANCELLED",
  ]),
  ORDERED: new Set<OrderFulfillmentStatus>([
    "RECEIVED",
    "OUT_OF_STOCK",
    "CANCELLED",
  ]),
  RECEIVED: new Set<OrderFulfillmentStatus>(["SHIPPED", "CANCELLED"]),
  SHIPPED: new Set<OrderFulfillmentStatus>(["COMPLETED"]),
  OUT_OF_STOCK: new Set<OrderFulfillmentStatus>(["CANCELLED"]),
  COMPLETED: new Set<OrderFulfillmentStatus>([]),
  CANCELLED: new Set<OrderFulfillmentStatus>([]),
};

/**
 * 驗證狀態轉換是否合法
 *
 * @param from - 目前狀態
 * @param to - 目標狀態
 * @returns 若轉換合法回傳 true，否則回傳 false
 */
export function isValidOrderStatusTransition(
  from: OrderFulfillmentStatus,
  to: OrderFulfillmentStatus,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.has(to);
}

/**
 * 取得目前狀態允許的下一步狀態列表
 *
 * @param current - 目前狀態
 * @returns 允許的目標狀態陣列
 */
export function getNextAllowedOrderStatuses(
  current: OrderFulfillmentStatus,
): OrderFulfillmentStatus[] {
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed) {
    return [];
  }
  return [...allowed];
}
