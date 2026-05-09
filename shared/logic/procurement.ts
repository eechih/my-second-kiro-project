/**
 * 採購驗證邏輯
 *
 * 驗證採購下單、入庫確認、取消操作的前置條件，以及計算採購成本。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：3.8, 4.8, 5.5, 6.1
 */

import type { LineItem, ValidationResult } from "../models/order";

/**
 * 驗證採購下單操作的前置條件。
 *
 * 規則：
 * - status 必須為「待處理」
 * - supplierId 非空字串
 * - unitCost >= 0
 *
 * @param lineItem - 明細項目（僅需 status 與 quantity）
 * @param supplierId - 供應商 ID
 * @param unitCost - 採購單位成本
 * @returns 驗證結果
 */
export function validateProcurementOrder(
  lineItem: Pick<LineItem, "status" | "quantity">,
  supplierId: string,
  unitCost: number,
): ValidationResult {
  if (lineItem.status !== "待處理") {
    return {
      valid: false,
      error: "此明細項目已完成採購下單",
    };
  }

  if (!supplierId || supplierId.trim().length === 0) {
    return {
      valid: false,
      error: "供應商為必填",
    };
  }

  if (typeof unitCost !== "number" || Number.isNaN(unitCost) || unitCost < 0) {
    return {
      valid: false,
      error: "單位成本不可為負數",
    };
  }

  return { valid: true };
}

/**
 * 驗證入庫確認操作的前置條件。
 *
 * 規則：
 * - status 必須為「已訂購」
 * - purchasedQuantity 必須 > 0
 *
 * @param lineItem - 明細項目（僅需 status 與 purchasedQuantity）
 * @returns 驗證結果
 */
export function validateProcurementReceive(
  lineItem: Pick<LineItem, "status" | "purchasedQuantity">,
): ValidationResult {
  if (lineItem.status !== "已訂購") {
    return {
      valid: false,
      error: "僅「已訂購」狀態的明細項目可確認入庫",
    };
  }

  if (lineItem.purchasedQuantity <= 0) {
    return {
      valid: false,
      error: "採購數量必須大於零",
    };
  }

  return { valid: true };
}

/**
 * 驗證採購取消操作的前置條件。
 *
 * 規則：
 * - status 必須為「待處理」或「已訂購」
 * - 已收到、已出貨、缺貨的明細項目不可取消
 *
 * @param lineItem - 明細項目（僅需 status）
 * @returns 驗證結果
 */
export function validateProcurementCancel(
  lineItem: Pick<LineItem, "status">,
): ValidationResult {
  if (lineItem.status === "待處理" || lineItem.status === "已訂購") {
    return { valid: true };
  }

  return {
    valid: false,
    error: "已入庫或已出貨的明細項目無法取消採購",
  };
}

/**
 * 計算採購總成本。
 *
 * 規則：
 * - purchasedQuantity >= 0
 * - unitCost >= 0
 * - 回傳 purchasedQuantity × unitCost，結果 >= 0
 *
 * @param purchasedQuantity - 採購數量（必須 >= 0）
 * @param unitCost - 單位成本（必須 >= 0）
 * @returns 採購總成本
 */
export function calculateProcurementCost(
  purchasedQuantity: number,
  unitCost: number,
): number {
  return purchasedQuantity * unitCost;
}
