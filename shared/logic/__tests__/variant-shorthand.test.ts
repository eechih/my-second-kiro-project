/**
 * 單元測試：variant-shorthand 解析器模組
 *
 * 覆蓋具體範例與邊界情況，驗證 parseVariantShorthand、printVariantShorthand、countCombinations。
 * 需求：1.1–1.8, 2.1–2.3, 3.1, 4.6
 */

import { describe, it, expect } from "vitest";
import {
  parseVariantShorthand,
  printVariantShorthand,
  countCombinations,
} from "../variant-shorthand";

describe("parseVariantShorthand", () => {
  describe("基本解析", () => {
    it("解析 [白，黑/35，36，37] 為 2 個維度", () => {
      const result = parseVariantShorthand("[白，黑/35，36，37]");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑"] });
      expect(result[1]).toEqual({ name: "維度2", values: ["35", "36", "37"] });
    });

    it("解析多維度 [S，M，L/紅，藍/棉，聚酯] 為 3 個維度", () => {
      const result = parseVariantShorthand("[S，M，L/紅，藍/棉，聚酯]");
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ name: "維度1", values: ["S", "M", "L"] });
      expect(result[1]).toEqual({ name: "維度2", values: ["紅", "藍"] });
      expect(result[2]).toEqual({ name: "維度3", values: ["棉", "聚酯"] });
    });
  });

  describe("單一維度", () => {
    it("解析 白，黑，灰 為 1 個維度，名為 維度1", () => {
      const result = parseVariantShorthand("白，黑，灰");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑", "灰"] });
    });

    it("解析 [白，黑，灰] 為 1 個維度", () => {
      const result = parseVariantShorthand("[白，黑，灰]");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑", "灰"] });
    });
  });

  describe("混合逗號", () => {
    it("解析 白,黑，灰 正確處理全形與半形逗號", () => {
      const result = parseVariantShorthand("白,黑，灰");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑", "灰"] });
    });

    it("解析 [白,黑/35,36,37] 半形逗號分隔", () => {
      const result = parseVariantShorthand("[白,黑/35,36,37]");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑"] });
      expect(result[1]).toEqual({ name: "維度2", values: ["35", "36", "37"] });
    });
  });

  describe("重複值移除", () => {
    it("解析 白，黑，白 移除重複值，保留首次出現順序", () => {
      const result = parseVariantShorthand("白，黑，白");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑"] });
    });

    it("解析 S，M，L，M，S 移除多個重複值", () => {
      const result = parseVariantShorthand("S，M，L，M，S");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "維度1", values: ["S", "M", "L"] });
    });
  });

  describe("空白處理", () => {
    it("解析 [ 白 ， 黑 ] 去除值前後空白", () => {
      const result = parseVariantShorthand("[ 白 ， 黑 ]");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑"] });
    });

    it("解析含前後空白的輸入", () => {
      const result = parseVariantShorthand("  白，黑  ");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑"] });
    });

    it("解析維度間含空白 [ 白 ， 黑 / 35 ， 36 ]", () => {
      const result = parseVariantShorthand("[ 白 ， 黑 / 35 ， 36 ]");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑"] });
      expect(result[1]).toEqual({ name: "維度2", values: ["35", "36"] });
    });
  });

  describe("空輸入", () => {
    it('空字串 "" 回傳空陣列', () => {
      const result = parseVariantShorthand("");
      expect(result).toEqual([]);
    });

    it('純空白 "   " 回傳空陣列', () => {
      const result = parseVariantShorthand("   ");
      expect(result).toEqual([]);
    });

    it('空方括號 "[]" 回傳空陣列', () => {
      const result = parseVariantShorthand("[]");
      expect(result).toEqual([]);
    });

    it('方括號內僅空白 "[  ]" 回傳空陣列', () => {
      const result = parseVariantShorthand("[  ]");
      expect(result).toEqual([]);
    });
  });

  describe("空群組處理", () => {
    it("解析 白，黑//35 跳過空群組，產生 2 個維度", () => {
      const result = parseVariantShorthand("白，黑//35");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑"] });
      expect(result[1]).toEqual({ name: "維度2", values: ["35"] });
    });

    it("解析 //白，黑 跳過前導空群組", () => {
      const result = parseVariantShorthand("//白，黑");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑"] });
    });

    it("解析 白，黑// 跳過尾隨空群組", () => {
      const result = parseVariantShorthand("白，黑//");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "維度1", values: ["白", "黑"] });
    });

    it("僅有分隔符 /// 回傳空陣列", () => {
      const result = parseVariantShorthand("///");
      expect(result).toEqual([]);
    });

    it("僅有逗號 ，，， 回傳空陣列", () => {
      const result = parseVariantShorthand("，，，");
      expect(result).toEqual([]);
    });
  });

  describe("方括號為可選", () => {
    it("有無方括號結果相同", () => {
      const withBrackets = parseVariantShorthand("[白，黑/35，36]");
      const withoutBrackets = parseVariantShorthand("白，黑/35，36");
      expect(withBrackets).toEqual(withoutBrackets);
    });
  });
});

describe("printVariantShorthand", () => {
  it("空陣列回傳空字串", () => {
    const result = printVariantShorthand([]);
    expect(result).toBe("");
  });

  it("單一維度格式化為 [值1，值2]", () => {
    const result = printVariantShorthand([
      { name: "維度1", values: ["白", "黑", "灰"] },
    ]);
    expect(result).toBe("[白，黑，灰]");
  });

  it("多維度格式化為 [值1，值2/值3，值4]", () => {
    const result = printVariantShorthand([
      { name: "維度1", values: ["白", "黑"] },
      { name: "維度2", values: ["35", "36", "37"] },
    ]);
    expect(result).toBe("[白，黑/35，36，37]");
  });

  it("三維度格式化正確", () => {
    const result = printVariantShorthand([
      { name: "維度1", values: ["S", "M", "L"] },
      { name: "維度2", values: ["紅", "藍"] },
      { name: "維度3", values: ["棉"] },
    ]);
    expect(result).toBe("[S，M，L/紅，藍/棉]");
  });

  it("格式化後再解析產生等價結果（往返）", () => {
    const original = [
      { name: "維度1", values: ["白", "黑"] },
      { name: "維度2", values: ["35", "36", "37"] },
    ];
    const printed = printVariantShorthand(original);
    const parsed = parseVariantShorthand(printed);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.values).toEqual(["白", "黑"]);
    expect(parsed[1]!.values).toEqual(["35", "36", "37"]);
  });
});

describe("countCombinations", () => {
  it("空陣列回傳 0", () => {
    expect(countCombinations([])).toBe(0);
  });

  it("單一維度回傳該維度值的數量", () => {
    expect(
      countCombinations([{ name: "維度1", values: ["白", "黑", "灰"] }]),
    ).toBe(3);
  });

  it("兩個維度回傳乘積 (2 × 3 = 6)", () => {
    expect(
      countCombinations([
        { name: "維度1", values: ["白", "黑"] },
        { name: "維度2", values: ["35", "36", "37"] },
      ]),
    ).toBe(6);
  });

  it("三個維度回傳乘積 (3 × 2 × 2 = 12)", () => {
    expect(
      countCombinations([
        { name: "維度1", values: ["S", "M", "L"] },
        { name: "維度2", values: ["紅", "藍"] },
        { name: "維度3", values: ["棉", "聚酯"] },
      ]),
    ).toBe(12);
  });

  it("任一維度為空時回傳 0", () => {
    expect(
      countCombinations([
        { name: "維度1", values: ["白", "黑"] },
        { name: "維度2", values: [] },
      ]),
    ).toBe(0);
  });

  it("單一值的維度回傳正確乘積", () => {
    expect(
      countCombinations([
        { name: "維度1", values: ["白"] },
        { name: "維度2", values: ["35"] },
      ]),
    ).toBe(1);
  });

  it("與 parseVariantShorthand 結合使用", () => {
    const dims = parseVariantShorthand("[白，黑/35，36，37，38，39，40]");
    expect(countCombinations(dims)).toBe(12);
  });
});
