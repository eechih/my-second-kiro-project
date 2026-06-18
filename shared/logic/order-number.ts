/**
 * 訂單編號產生器
 *
 * 產生格式為 ORD-YYYYMMDD-XXXX 的唯一訂單編號。
 * YYYY = 西元年、MM = 月、DD = 日、XXXX = 4 碼隨機大寫英數字。
 *
 * 需求：1.6
 */

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * 產生唯一訂單編號。
 *
 * 格式：ORD-YYYYMMDD-XXXX
 * - YYYYMMDD: 當天日期
 * - XXXX: 4 碼隨機大寫英數字（A-Z, 0-9）
 *
 * @returns 格式化的訂單編號字串
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const datePart = `${year}${month}${day}`;

  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    const index = Math.floor(Math.random() * CHARSET.length);
    randomPart += CHARSET[index];
  }

  return `ORD-${datePart}-${randomPart}`;
}
