/**
 * 快速規格輸入簡寫語法解析器與格式化器
 *
 * 提供簡寫語法字串與 SpecDimension[] 之間的轉換，以及組合數計算。
 * 此模組為純函式，無副作用，前端與 Lambda 共用。
 *
 * 語法規則：
 * - 以 `[` 和 `]` 包裹（可選）
 * - 以 `/` 分隔不同維度群組
 * - 以全形逗號 `，` 或半形逗號 `,` 分隔同一維度內的選項值
 * - 自動去除前後空白
 * - 自動移除同一維度內重複值（保留首次出現順序）
 * - 自動產生維度名稱：維度1、維度2、維度3...
 *
 * 需求：1.1–1.8, 2.1–2.3, 3.1, 3.2, 4.6, 6.1–6.4
 */

import type { SpecDimension } from "../models/product";

/**
 * 解析簡寫語法字串為 SpecDimension 陣列。
 *
 * @param input - 簡寫語法字串
 * @returns 解析後的 SpecDimension 陣列（空輸入回傳空陣列）
 */
export function parseVariantShorthand(input: string): SpecDimension[] {
  // 1. 去除前後空白
  let trimmed = input.trim();

  // 2. 若為空字串，回傳空陣列
  if (trimmed === "") {
    return [];
  }

  // 3. 去除外層方括號（若有）
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    trimmed = trimmed.slice(1, -1);
  }

  // 若去除括號後為空，回傳空陣列
  if (trimmed.trim() === "") {
    return [];
  }

  // 4. 以 "/" 分割為維度群組字串陣列
  const groups = trimmed.split("/");

  // 5. 對每個群組解析
  const dimensions: SpecDimension[] = [];
  let dimensionIndex = 1;

  for (const group of groups) {
    // a. 以正則 /[，,]/ 分割為值陣列
    const rawValues = group.split(/[，,]/);

    // b. 對每個值去除前後空白，c. 過濾空字串
    const trimmedValues = rawValues
      .map((v) => v.trim())
      .filter((v) => v !== "");

    // d. 去除重複值（保留首次出現順序）
    const uniqueValues: string[] = [];
    const seen = new Set<string>();
    for (const value of trimmedValues) {
      if (!seen.has(value)) {
        seen.add(value);
        uniqueValues.push(value);
      }
    }

    // e. 若結果非空，建立 SpecDimension
    if (uniqueValues.length > 0) {
      dimensions.push({
        name: `維度${dimensionIndex}`,
        values: uniqueValues,
      });
      dimensionIndex++;
    }
  }

  // 6. 回傳非空維度的 SpecDimension 陣列
  return dimensions;
}

/**
 * 將 SpecDimension 陣列格式化為簡寫語法字串。
 *
 * 格式：[值1，值2/值3，值4，值5]
 * - 以 `/` 分隔不同維度
 * - 以 `，` 分隔同一維度內的值
 * - 以 `[]` 包裹
 *
 * @param dimensions - SpecDimension 陣列
 * @returns 格式化後的簡寫語法字串（空陣列回傳空字串）
 */
export function printVariantShorthand(dimensions: SpecDimension[]): string {
  if (dimensions.length === 0) {
    return "";
  }

  const inner = dimensions.map((dim) => dim.values.join("，")).join("/");

  return `[${inner}]`;
}

/**
 * 計算 SpecDimension 陣列的笛卡爾積組合數量。
 *
 * @param dimensions - SpecDimension 陣列
 * @returns 組合數量（空陣列或任一維度為空時回傳 0）
 */
export function countCombinations(dimensions: SpecDimension[]): number {
  if (dimensions.length === 0) {
    return 0;
  }

  let count = 1;
  for (const dim of dimensions) {
    if (dim.values.length === 0) {
      return 0;
    }
    count *= dim.values.length;
  }

  return count;
}
