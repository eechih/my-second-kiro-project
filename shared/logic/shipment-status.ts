/**
 * 出貨單狀態轉換驗證
 *
 * 需求：5.1, 5.2, 5.4, 5.6, 5.8
 */

import type { ShipmentStatus } from "../models/shipment";

/**
 * 出貨單狀態允許的轉換路徑
 *
 * - PENDING → SHIPPED, CANCELLED
 * - SHIPPED → DELIVERED
 * - DELIVERED → (終態)
 * - CANCELLED → (終態)
 */
export const ALLOWED_SHIPMENT_TRANSITIONS: Record<
  ShipmentStatus,
  ReadonlySet<ShipmentStatus>
> = {
  PENDING: new Set<ShipmentStatus>(["SHIPPED", "CANCELLED"]),
  SHIPPED: new Set<ShipmentStatus>(["DELIVERED"]),
  DELIVERED: new Set<ShipmentStatus>([]),
  CANCELLED: new Set<ShipmentStatus>([]),
};

/**
 * 驗證出貨單狀態轉換是否合法
 *
 * @param from - 目前狀態
 * @param to - 目標狀態
 * @returns 若轉換合法回傳 true，否則回傳 false
 */
export function isValidShipmentStatusTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  const allowed = ALLOWED_SHIPMENT_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.has(to);
}

/**
 * 取得目前出貨單狀態允許的下一步狀態列表
 *
 * @param current - 目前狀態
 * @returns 允許的目標狀態陣列
 */
export function getNextAllowedShipmentStatuses(
  current: ShipmentStatus,
): ShipmentStatus[] {
  const allowed = ALLOWED_SHIPMENT_TRANSITIONS[current];
  if (!allowed) {
    return [];
  }
  return [...allowed];
}
