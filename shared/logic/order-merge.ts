/**
 * 訂單合併邏輯
 *
 * 提供訂單合併的前置驗證與合併資料產生函式。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 合併規則：
 * - 至少選取兩筆訂單
 * - 所有訂單必須屬於同一客戶
 * - 所有訂單狀態必須為 pending 或 confirmed
 * - 合併後新訂單包含所有來源訂單的全部明細項目
 * - 合併後新訂單總金額等於所有來源訂單總金額的加總
 *
 * 需求：9.1, 9.2, 9.3, 9.4
 */

import type {
  LineItem,
  Order,
  OrderStatus,
  ValidationResult,
} from "../models/order";
import { calculateOrderTotal } from "./order-calculations";

// ---------------------------------------------------------------------------
// 型別
// ---------------------------------------------------------------------------

/** 合併後產生的訂單資料（不含 id、orderNumber 等由系統產生的欄位） */
export interface MergedOrderData {
  /** 客戶 ID */
  customerId: string;
  /** 客戶名稱（反正規化） */
  customerName: string;
  /** 合併後的所有明細項目（來自所有來源訂單） */
  lineItems: LineItem[];
  /** 合併後的訂單總金額 */
  totalAmount: number;
  /** 合併後訂單的初始狀態 */
  status: OrderStatus;
  /** 來源訂單 ID 列表（用於後續將來源訂單標記為 cancelled） */
  sourceOrderIds: string[];
}

// ---------------------------------------------------------------------------
// 允許合併的訂單狀態
// ---------------------------------------------------------------------------

/** 允許合併的訂單狀態集合 */
const MERGEABLE_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "pending",
  "confirmed",
]);

// ---------------------------------------------------------------------------
// 驗證
// ---------------------------------------------------------------------------

/**
 * 驗證一組訂單是否可以合併。
 *
 * 驗證規則：
 * 1. 至少需要兩筆訂單
 * 2. 所有訂單必須屬於同一客戶
 * 3. 所有訂單狀態必須為 pending 或 confirmed
 *
 * @param orders - 欲合併的訂單列表
 * @returns 驗證結果。若失敗，error 包含對應的錯誤訊息。
 */
export function validateMergeOrders(orders: Order[]): ValidationResult {
  // 規則 1：至少兩筆訂單
  if (orders.length < 2) {
    return {
      valid: false,
      error: "至少需要選取兩筆訂單才能合併",
    };
  }

  // 規則 2：同一客戶（需求 9.3）
  const firstCustomerId = orders[0]!.customerId;
  const hasDifferentCustomer = orders.some(
    (order) => order.customerId !== firstCustomerId,
  );
  if (hasDifferentCustomer) {
    return {
      valid: false,
      error: "僅能合併同一客戶的訂單",
    };
  }

  // 規則 3：狀態為 pending 或 confirmed（需求 9.4）
  const invalidOrder = orders.find(
    (order) => !MERGEABLE_STATUSES.has(order.status),
  );
  if (invalidOrder) {
    return {
      valid: false,
      error: "僅能合併待處理或已確認的訂單",
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// 合併
// ---------------------------------------------------------------------------

/**
 * 將多筆訂單合併為一筆新訂單的資料。
 *
 * 合併邏輯：
 * - 新訂單包含所有來源訂單的全部明細項目
 * - 新訂單總金額等於所有來源訂單總金額的加總（透過重新計算確保正確性）
 * - 新訂單初始狀態為 pending
 * - 記錄所有來源訂單 ID，供呼叫端將來源訂單標記為 cancelled
 *
 * 注意：此函式不執行驗證，呼叫前應先呼叫 `validateMergeOrders` 確認合法性。
 *
 * @param orders - 欲合併的訂單列表（應已通過 validateMergeOrders 驗證）
 * @returns 合併後的訂單資料
 */
export function mergeOrders(orders: Order[]): MergedOrderData {
  const firstOrder = orders[0]!;

  // 收集所有來源訂單的明細項目
  const allLineItems: LineItem[] = orders.flatMap((order) => order.lineItems);

  // 重新計算總金額，確保一致性（需求 9.2）
  const totalAmount = calculateOrderTotal(allLineItems);

  return {
    customerId: firstOrder.customerId,
    customerName: firstOrder.customerName,
    lineItems: allLineItems,
    totalAmount,
    status: "pending",
    sourceOrderIds: orders.map((order) => order.id),
  };
}
