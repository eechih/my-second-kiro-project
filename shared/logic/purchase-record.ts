/**
 * 採購記錄狀態轉換驗證與數量計算
 *
 * 允許路徑：
 *   pending → received
 *   pending → cancelled
 *   received → cancelled 不允許（已入庫記錄無法取消）
 *
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：6.2, 6.3, 6.8, 6.9
 */

import type { PurchaseRecordStatus, ValidationResult } from "../models/order";

/**
 * 合法的採購記錄狀態轉換對照表。
 * key 為來源狀態，value 為該狀態可轉換至的目標狀態集合。
 */
const ALLOWED_TRANSITIONS: Record<
  PurchaseRecordStatus,
  ReadonlySet<PurchaseRecordStatus>
> = {
  pending: new Set<PurchaseRecordStatus>(["received", "cancelled"]),
  received: new Set<PurchaseRecordStatus>([]),
  cancelled: new Set<PurchaseRecordStatus>([]),
};

/**
 * 驗證採購記錄狀態轉換是否合法。
 *
 * @param from - 目前採購記錄狀態
 * @param to - 目標採購記錄狀態
 * @returns 若轉換合法回傳 `true`，否則回傳 `false`
 */
export function isValidPurchaseStatusTransition(
  from: PurchaseRecordStatus,
  to: PurchaseRecordStatus,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.has(to);
}

/**
 * 取得指定採購記錄狀態可轉換至的所有合法目標狀態。
 *
 * @param current - 目前採購記錄狀態
 * @returns 可轉換至的目標狀態陣列
 */
export function getNextAllowedPurchaseStatuses(
  current: PurchaseRecordStatus,
): PurchaseRecordStatus[] {
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed) {
    return [];
  }
  return [...allowed];
}

/**
 * 計算明細項目的未採購餘額。
 *
 * @param orderQuantity - 訂單數量（明細項目的訂購數量）
 * @param purchasedQuantity - 累計已採購數量
 * @returns 未採購餘額（orderQuantity - purchasedQuantity）
 */
export function calculateRemainingPurchaseQuantity(
  orderQuantity: number,
  purchasedQuantity: number,
): number {
  return orderQuantity - purchasedQuantity;
}

/**
 * 驗證採購數量是否合法。
 *
 * 規則：
 * - 採購數量必須大於 0
 * - 採購數量不得超過未採購餘額
 *
 * @param requestedQty - 本次請求的採購數量
 * @param remainingQty - 未採購餘額（可透過 calculateRemainingPurchaseQuantity 計算）
 * @returns 驗證結果
 */
export function validatePurchaseQuantity(
  requestedQty: number,
  remainingQty: number,
): ValidationResult {
  if (requestedQty <= 0) {
    return { valid: false, error: "採購數量必須大於 0" };
  }

  if (requestedQty > remainingQty) {
    return {
      valid: false,
      error: `採購數量（${requestedQty}）超過未採購餘額（${remainingQty}）`,
    };
  }

  return { valid: true };
}

/**
 * 入庫確認後計算新庫存數量。
 *
 * @param stockQuantity - 目前庫存數量
 * @param receivedQty - 入庫數量
 * @returns 新庫存數量（stockQuantity + receivedQty）
 *
 * @remarks
 * 呼叫端負責判斷應更新規格組合層級或商品層級的庫存。
 */
export function applyReceived(
  stockQuantity: number,
  receivedQty: number,
): number {
  return stockQuantity + receivedQty;
}
