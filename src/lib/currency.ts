/**
 * 貨幣格式化工具
 *
 * 系統以整數（元）儲存所有金額，不使用小數點。
 * UI 顯示時使用千分位格式化，不顯示小數。
 */

/**
 * 格式化金額為顯示字串（含 $ 前綴）。
 *
 * @example formatCurrency(1500) → "$1,500"
 * @example formatCurrency(100) → "$100"
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;
}

/**
 * 格式化金額為數字字串（不含 $ 前綴）。
 *
 * @example formatAmount(1500) → "1,500"
 * @example formatAmount(100) → "100"
 */
export function formatAmount(amount: number): string {
  return amount.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}
