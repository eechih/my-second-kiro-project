/**
 * 明細項目狀態轉換驗證
 *
 * 允許路徑：
 *   pending → ordered → received → shipped
 *   pending → out_of_stock
 *   ordered → out_of_stock
 *
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：4.10, 7.1
 */

import type { LineItemStatus } from "../models/order";

/**
 * 合法的明細項目狀態轉換對照表。
 * key 為來源狀態，value 為該狀態可轉換至的目標狀態集合。
 */
const ALLOWED_TRANSITIONS: Record<
  LineItemStatus,
  ReadonlySet<LineItemStatus>
> = {
  pending: new Set<LineItemStatus>(["ordered", "out_of_stock"]),
  ordered: new Set<LineItemStatus>(["received", "out_of_stock"]),
  received: new Set<LineItemStatus>(["shipped"]),
  shipped: new Set<LineItemStatus>([]),
  out_of_stock: new Set<LineItemStatus>([]),
};

/**
 * 驗證明細項目狀態轉換是否合法。
 *
 * @param from - 目前明細項目狀態
 * @param to - 目標明細項目狀態
 * @returns 若轉換合法回傳 `true`，否則回傳 `false`
 */
export function isValidLineItemStatusTransition(
  from: LineItemStatus,
  to: LineItemStatus,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.has(to);
}

/**
 * 取得指定明細項目狀態可轉換至的所有合法目標狀態。
 *
 * @param current - 目前明細項目狀態
 * @returns 可轉換至的目標狀態陣列
 */
export function getNextAllowedLineItemStatuses(
  current: LineItemStatus,
): LineItemStatus[] {
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed) {
    return [];
  }
  return [...allowed];
}
