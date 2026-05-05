/**
 * Avatar 工具函式模組
 * 從客戶名稱衍生一致的 Avatar 背景色彩與顯示字元
 */

/** 預設 Avatar 背景色彩（用於空字串） */
const DEFAULT_COLOR = "#9E9E9E";

/** 預定義的 Avatar 色彩調色盤 */
const AVATAR_COLORS: readonly string[] = [
  "#F44336",
  "#E91E63",
  "#9C27B0",
  "#673AB7",
  "#3F51B5",
  "#2196F3",
  "#03A9F4",
  "#00BCD4",
  "#009688",
  "#4CAF50",
  "#8BC34A",
  "#CDDC39",
  "#FF9800",
  "#FF5722",
  "#795548",
  "#607D8B",
];

/**
 * 從名稱字串衍生一致的十六進位背景色彩
 * 對相同輸入始終回傳相同的有效 #RRGGBB 格式色彩
 *
 * @param name - 客戶名稱字串
 * @returns 十六進位色彩值（格式 #RRGGBB）
 */
export function getAvatarColor(name: string): string {
  if (!name) {
    return DEFAULT_COLOR;
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index]!;
}

/**
 * 取得名稱的第一個字元作為 Avatar 顯示文字
 *
 * @param name - 客戶名稱字串
 * @returns 名稱的第一個字元，空字串時回傳空字串
 */
export function getAvatarLetter(name: string): string {
  if (!name) {
    return "";
  }

  return name.charAt(0);
}
