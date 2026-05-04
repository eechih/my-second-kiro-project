/**
 * 訂單狀態轉換驗證
 *
 * 允許路徑：
 *   pending → confirmed → shipping → completed
 *   任何狀態 → cancelled
 *
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：5.1, 5.2, 5.3
 */

import type { OrderStatus } from "../models/order";

/**
 * 合法的訂單狀態轉換對照表。
 * key 為來源狀態，value 為該狀態可轉換至的目標狀態集合。
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  pending: new Set<OrderStatus>(["confirmed", "cancelled"]),
  confirmed: new Set<OrderStatus>(["shipping", "cancelled"]),
  shipping: new Set<OrderStatus>(["completed", "cancelled"]),
  completed: new Set<OrderStatus>(["cancelled"]),
  cancelled: new Set<OrderStatus>([]),
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
