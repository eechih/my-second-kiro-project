/**
 * 訂單分拆邏輯
 *
 * 提供訂單分拆的前置驗證與分拆資料產生函式。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 分拆規則：
 * - 原訂單狀態必須為 pending 或 confirmed
 * - 所有明細項目皆必須有分配目標
 * - 至少需要分配到兩筆新訂單
 * - 分拆後所有新訂單的明細項目總和等於原訂單（數量守恆）
 * - 原訂單狀態變更為 cancelled
 *
 * 需求：9.5, 9.6, 9.7
 */

import type {
  LineItem,
  Order,
  OrderStatus,
  SplitAllocation,
  ValidationResult,
} from "../models/order";
import { calculateOrderTotal } from "./order-calculations";

// ---------------------------------------------------------------------------
// 型別
// ---------------------------------------------------------------------------

/** 分拆後產生的單筆新訂單資料（不含 id、orderNumber 等由系統產生的欄位） */
export interface SplitOrderData {
  /** 客戶 ID */
  customerId: string;
  /** 客戶名稱（反正規化） */
  customerName: string;
  /** 分配到此新訂單的明細項目 */
  lineItems: LineItem[];
  /** 新訂單總金額 */
  totalAmount: number;
  /** 新訂單的初始狀態 */
  status: OrderStatus;
  /** 原訂單 ID（用於追溯來源） */
  sourceOrderId: string;
}

// ---------------------------------------------------------------------------
// 允許分拆的訂單狀態
// ---------------------------------------------------------------------------

/** 允許分拆的訂單狀態集合 */
const SPLITTABLE_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "pending",
  "confirmed",
]);

// ---------------------------------------------------------------------------
// 驗證
// ---------------------------------------------------------------------------

/**
 * 驗證訂單是否可以依指定的分配方式進行分拆。
 *
 * 驗證規則：
 * 1. 訂單狀態必須為 pending 或 confirmed（需求 9.7）
 * 2. 分配列表不可為空
 * 3. 所有明細項目皆必須有分配目標（不可遺漏）
 * 4. 分配列表中的明細項目 ID 必須存在於原訂單中（不可包含不存在的明細）
 * 5. 至少需要分配到兩筆不同的新訂單
 * 6. 每筆明細項目只能分配一次（不可重複）
 *
 * @param order - 欲分拆的原訂單
 * @param allocations - 明細項目分配方式
 * @returns 驗證結果。若失敗，error 包含對應的錯誤訊息。
 */
export function validateSplitOrder(
  order: Order,
  allocations: SplitAllocation[],
): ValidationResult {
  // 規則 1：狀態檢查（需求 9.7）
  if (!SPLITTABLE_STATUSES.has(order.status)) {
    return {
      valid: false,
      error: "僅能分拆待處理或已確認的訂單",
    };
  }

  // 規則 2：分配列表不可為空
  if (allocations.length === 0) {
    return {
      valid: false,
      error: "分配列表不可為空",
    };
  }

  // 建立原訂單明細 ID 集合，用於後續驗證
  const orderLineItemIds = new Set(order.lineItems.map((li) => li.id));

  // 規則 4：分配列表中的明細 ID 必須存在於原訂單
  const invalidAllocation = allocations.find(
    (a) => !orderLineItemIds.has(a.lineItemId),
  );
  if (invalidAllocation) {
    return {
      valid: false,
      error: `明細項目 ${invalidAllocation.lineItemId} 不存在於此訂單中`,
    };
  }

  // 規則 6：每筆明細項目只能分配一次
  const allocatedLineItemIds = new Set<string>();
  for (const allocation of allocations) {
    if (allocatedLineItemIds.has(allocation.lineItemId)) {
      return {
        valid: false,
        error: `明細項目 ${allocation.lineItemId} 重複分配`,
      };
    }
    allocatedLineItemIds.add(allocation.lineItemId);
  }

  // 規則 3：所有明細項目皆必須有分配目標
  const unallocatedIds: string[] = [];
  for (const lineItemId of orderLineItemIds) {
    if (!allocatedLineItemIds.has(lineItemId)) {
      unallocatedIds.push(lineItemId);
    }
  }
  if (unallocatedIds.length > 0) {
    return {
      valid: false,
      error: "所有明細項目皆必須有分配目標",
    };
  }

  // 規則 5：至少分配到兩筆不同的新訂單
  const targetOrderIndices = new Set(
    allocations.map((a) => a.targetOrderIndex),
  );
  if (targetOrderIndices.size < 2) {
    return {
      valid: false,
      error: "至少需要分配到兩筆不同的新訂單",
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// 分拆
// ---------------------------------------------------------------------------

/**
 * 將一筆訂單依指定的分配方式分拆為多筆新訂單的資料。
 *
 * 分拆邏輯：
 * - 依 targetOrderIndex 將明細項目分組至對應的新訂單
 * - 每筆新訂單的總金額由其包含的明細項目重新計算（需求 9.6 數量守恆）
 * - 每筆新訂單初始狀態為 pending
 * - 記錄原訂單 ID，供呼叫端將原訂單標記為 cancelled
 *
 * 注意：此函式不執行驗證，呼叫前應先呼叫 `validateSplitOrder` 確認合法性。
 *
 * @param order - 欲分拆的原訂單（應已通過 validateSplitOrder 驗證）
 * @param allocations - 明細項目分配方式
 * @returns 分拆後的新訂單資料列表，依 targetOrderIndex 排序
 */
export function splitOrder(
  order: Order,
  allocations: SplitAllocation[],
): SplitOrderData[] {
  // 建立明細項目 ID → LineItem 的查找表
  const lineItemMap = new Map<string, LineItem>();
  for (const lineItem of order.lineItems) {
    lineItemMap.set(lineItem.id, lineItem);
  }

  // 依 targetOrderIndex 分組明細項目
  const groupedLineItems = new Map<number, LineItem[]>();
  for (const allocation of allocations) {
    const lineItem = lineItemMap.get(allocation.lineItemId);
    if (!lineItem) {
      continue; // 理論上不會發生（已通過驗證）
    }

    const group = groupedLineItems.get(allocation.targetOrderIndex);
    if (group) {
      group.push(lineItem);
    } else {
      groupedLineItems.set(allocation.targetOrderIndex, [lineItem]);
    }
  }

  // 依 targetOrderIndex 排序後產生新訂單資料
  const sortedIndices = [...groupedLineItems.keys()].sort((a, b) => a - b);

  return sortedIndices.map((index) => {
    const lineItems = groupedLineItems.get(index)!;
    const totalAmount = calculateOrderTotal(lineItems);

    return {
      customerId: order.customerId,
      customerName: order.customerName,
      lineItems,
      totalAmount,
      status: "pending" as OrderStatus,
      sourceOrderId: order.id,
    };
  });
}
