import type { Customer } from "../../shared/models/customer";

/**
 * 排序欄位型別定義
 * 需求：1.5
 */
export type SortField = "name" | "contactPerson" | "phone" | "createdAt";

/**
 * 計算表格列號
 * 需求：3.2
 *
 * @param page - 目前頁碼（從 0 開始）
 * @param pageSize - 每頁筆數（必須 > 0）
 * @param rowIndex - 列索引（從 0 開始）
 * @returns 從 1 開始的連續列號
 */
export function getRowNumber(
  page: number,
  pageSize: number,
  rowIndex: number,
): number {
  return page * pageSize + rowIndex + 1;
}

/**
 * 依指定欄位排序客戶陣列（升序，字串比較）
 * 需求：1.5
 *
 * @param customers - 客戶陣列
 * @param field - 排序欄位
 * @returns 排序後的新陣列（不修改原陣列）
 */
export function sortCustomers(
  customers: Customer[],
  field: SortField,
): Customer[] {
  return [...customers].sort((a, b) => {
    const valueA = a[field] ?? "";
    const valueB = b[field] ?? "";
    return valueA.localeCompare(valueB);
  });
}
