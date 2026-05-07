/**
 * 快速規格輸入解析器——屬性測試
 *
 * Feature: quick-variant-input
 *
 * 屬性 1：往返 — 格式化後再解析保留維度
 * 屬性 2：穩定化 — parse-print-parse 等於 parse
 * 屬性 3：解析後的值已去除空白
 * 屬性 4：每個維度內的值唯一
 * 屬性 5：維度命名遵循順序模式
 * 屬性 6：方括號為可選且不影響結果
 * 屬性 7：全形與半形逗號為等價分隔符
 * 屬性 8：結果中僅包含非空維度
 * 屬性 9：組合數等於各維度大小的乘積
 *
 * 驗證需求：1.1–1.8, 2.1–2.3, 3.1, 3.2, 4.6, 6.1, 6.2
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  parseVariantShorthand,
  printVariantShorthand,
  countCombinations,
} from "../variant-shorthand";
import type { SpecDimension } from "../../models/product";

// ---------------------------------------------------------------------------
// 輔助 Arbitrary
// ---------------------------------------------------------------------------

/** 排除分隔符字元的有效值字元集（不含 /、，、,、[、]） */
const VALID_VALUE_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789白黑紅藍綠黃紫橙粉灰".split(
    "",
  );

/** 產生不含分隔符的非空字串（用於維度值） */
const validValueArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...VALID_VALUE_CHARS), { minLength: 1, maxLength: 5 })
  .map((chars) => chars.join(""));

/** 產生 1~4 組 SpecDimension（維度名稱自動編號） */
const specDimensionsArb: fc.Arbitrary<SpecDimension[]> = fc
  .integer({ min: 1, max: 4 })
  .chain((count) =>
    fc
      .tuple(
        ...Array.from({ length: count }, () =>
          fc.uniqueArray(validValueArb, { minLength: 1, maxLength: 5 }),
        ),
      )
      .map((valuesArrays) =>
        valuesArrays.map((values, idx) => ({
          name: `維度${idx + 1}`,
          values,
        })),
      ),
  );

/** 產生有效的簡寫語法字串（含隨機空白與逗號類型） */
const shorthandInputArb: fc.Arbitrary<string> = specDimensionsArb.chain(
  (dims) => {
    // 將 dims 轉為簡寫語法字串，隨機使用全形或半形逗號
    return fc
      .tuple(
        fc.boolean(), // 是否加方括號
        fc.constantFrom("，", ","), // 逗號類型
      )
      .map(([useBrackets, comma]) => {
        const inner = dims.map((dim) => dim.values.join(comma)).join("/");
        return useBrackets ? `[${inner}]` : inner;
      });
  },
);

/** 產生空白字串 */
const whitespaceArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(" ", "\t", "\n"), { minLength: 0, maxLength: 5 })
  .map((chars) => chars.join(""));

// ---------------------------------------------------------------------------
// Feature: quick-variant-input, Property 1: Round-trip — print then parse preserves dimensions
// ---------------------------------------------------------------------------

describe("屬性 1：往返 — 格式化後再解析保留維度", () => {
  it("parse(print(dims)) 應產生等價的 values 陣列", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        const printed = printVariantShorthand(dims);
        const parsed = parseVariantShorthand(printed);

        // 維度數量相同
        expect(parsed).toHaveLength(dims.length);

        // 每個維度的 values 相同（相同元素、相同順序）
        for (let i = 0; i < dims.length; i++) {
          expect(parsed[i]!.values).toEqual(dims[i]!.values);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: quick-variant-input, Property 2: Stabilization — parse-print-parse equals parse
// ---------------------------------------------------------------------------

describe("屬性 2：穩定化 — parse-print-parse 等於 parse", () => {
  it("parse(print(parse(input))) 應等於 parse(input) 的 values", () => {
    fc.assert(
      fc.property(shorthandInputArb, (input) => {
        const firstParse = parseVariantShorthand(input);
        const printed = printVariantShorthand(firstParse);
        const secondParse = parseVariantShorthand(printed);

        // 維度數量相同
        expect(secondParse).toHaveLength(firstParse.length);

        // 每個維度的 values 相同
        for (let i = 0; i < firstParse.length; i++) {
          expect(secondParse[i]!.values).toEqual(firstParse[i]!.values);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("空字串與純空白的穩定化", () => {
    fc.assert(
      fc.property(whitespaceArb, (ws) => {
        const firstParse = parseVariantShorthand(ws);
        const printed = printVariantShorthand(firstParse);
        const secondParse = parseVariantShorthand(printed);

        expect(firstParse).toEqual([]);
        expect(printed).toBe("");
        expect(secondParse).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: quick-variant-input, Property 3: Parsed values have no leading/trailing whitespace
// ---------------------------------------------------------------------------

describe("屬性 3：解析後的值已去除空白", () => {
  it("解析結果中每個值不應有前導或尾隨空白", () => {
    fc.assert(
      fc.property(
        specDimensionsArb,
        fc.constantFrom(" ", "  ", "\t"),
        (dims, ws) => {
          // 在值前後加入空白
          const inputWithWhitespace = dims
            .map((dim) => dim.values.map((v) => `${ws}${v}${ws}`).join("，"))
            .join("/");

          const parsed = parseVariantShorthand(inputWithWhitespace);

          for (const dim of parsed) {
            for (const value of dim.values) {
              expect(value).toBe(value.trim());
              expect(value.length).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: quick-variant-input, Property 4: Values within each dimension are unique
// ---------------------------------------------------------------------------

describe("屬性 4：每個維度內的值唯一", () => {
  it("解析結果中每個維度不應包含重複值", () => {
    fc.assert(
      fc.property(shorthandInputArb, (input) => {
        const parsed = parseVariantShorthand(input);

        for (const dim of parsed) {
          const uniqueValues = new Set(dim.values);
          expect(uniqueValues.size).toBe(dim.values.length);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("含重複值的輸入解析後應去除重複", () => {
    fc.assert(
      fc.property(validValueArb, validValueArb, (val1, val2) => {
        // 建立含重複值的輸入
        const input = `${val1}，${val2}，${val1}`;
        const parsed = parseVariantShorthand(input);

        expect(parsed).toHaveLength(1);
        const dim = parsed[0]!;
        const uniqueValues = new Set(dim.values);
        expect(uniqueValues.size).toBe(dim.values.length);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: quick-variant-input, Property 5: Dimension naming follows sequential pattern
// ---------------------------------------------------------------------------

describe("屬性 5：維度命名遵循順序模式", () => {
  it("產生 N 個維度時，名稱應依序為維度1、維度2、...、維度N", () => {
    fc.assert(
      fc.property(shorthandInputArb, (input) => {
        const parsed = parseVariantShorthand(input);

        for (let i = 0; i < parsed.length; i++) {
          expect(parsed[i]!.name).toBe(`維度${i + 1}`);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: quick-variant-input, Property 6: Brackets are optional and do not affect result
// ---------------------------------------------------------------------------

describe("屬性 6：方括號為可選且不影響結果", () => {
  it("parse('[' + content + ']') 應等於 parse(content)", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        // 產生不含方括號的內容字串
        const content = dims.map((dim) => dim.values.join("，")).join("/");

        const withBrackets = parseVariantShorthand(`[${content}]`);
        const withoutBrackets = parseVariantShorthand(content);

        expect(withBrackets).toHaveLength(withoutBrackets.length);
        for (let i = 0; i < withBrackets.length; i++) {
          expect(withBrackets[i]!.values).toEqual(withoutBrackets[i]!.values);
          expect(withBrackets[i]!.name).toEqual(withoutBrackets[i]!.name);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: quick-variant-input, Property 7: Full-width and half-width commas are equivalent
// ---------------------------------------------------------------------------

describe("屬性 7：全形與半形逗號為等價分隔符", () => {
  it("以全形逗號或半形逗號連接的值應產生相同結果", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(validValueArb, { minLength: 2, maxLength: 5 }),
        (values) => {
          const fullWidth = values.join("，");
          const halfWidth = values.join(",");

          const parsedFull = parseVariantShorthand(fullWidth);
          const parsedHalf = parseVariantShorthand(halfWidth);

          expect(parsedFull).toHaveLength(parsedHalf.length);
          for (let i = 0; i < parsedFull.length; i++) {
            expect(parsedFull[i]!.values).toEqual(parsedHalf[i]!.values);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("混合使用全形與半形逗號應正確解析所有值", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(validValueArb, { minLength: 3, maxLength: 5 }),
        (values) => {
          // 交替使用全形與半形逗號
          const mixed = values
            .map((v, i) => (i === 0 ? v : `${i % 2 === 0 ? "，" : ","}${v}`))
            .join("");

          const parsed = parseVariantShorthand(mixed);

          expect(parsed).toHaveLength(1);
          expect(parsed[0]!.values).toEqual(values);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: quick-variant-input, Property 8: Result contains only non-empty dimensions
// ---------------------------------------------------------------------------

describe("屬性 8：結果中僅包含非空維度", () => {
  it("解析結果中每個維度至少有一個值", () => {
    fc.assert(
      fc.property(shorthandInputArb, (input) => {
        const parsed = parseVariantShorthand(input);

        for (const dim of parsed) {
          expect(dim.values.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("純空白或空輸入應產生空陣列", () => {
    fc.assert(
      fc.property(whitespaceArb, (ws) => {
        const parsed = parseVariantShorthand(ws);
        expect(parsed).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("含空維度群組的輸入應跳過空群組", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        // 在維度之間插入空群組（連續的 /）
        const content = dims.map((dim) => dim.values.join("，")).join("//");

        const parsed = parseVariantShorthand(content);

        // 結果中每個維度都有值
        for (const dim of parsed) {
          expect(dim.values.length).toBeGreaterThan(0);
        }

        // 結果維度數量應等於原始有效維度數量
        expect(parsed).toHaveLength(dims.length);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: quick-variant-input, Property 9: Combination count equals product of dimension sizes
// ---------------------------------------------------------------------------

describe("屬性 9：組合數等於各維度大小的乘積", () => {
  it("countCombinations 應等於所有維度 values.length 的乘積", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        const count = countCombinations(dims);
        const expected = dims.reduce((acc, dim) => acc * dim.values.length, 1);

        expect(count).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it("空陣列應回傳 0", () => {
    expect(countCombinations([])).toBe(0);
  });

  it("任一維度為空時應回傳 0", () => {
    fc.assert(
      fc.property(specDimensionsArb, (dims) => {
        // 將第一個維度的 values 設為空
        const modified: SpecDimension[] = [
          { name: dims[0]!.name, values: [] },
          ...dims.slice(1),
        ];

        expect(countCombinations(modified)).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it("單一維度的組合數等於該維度的值數量", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(validValueArb, { minLength: 1, maxLength: 10 }),
        (values) => {
          const dims: SpecDimension[] = [{ name: "維度1", values }];
          expect(countCombinations(dims)).toBe(values.length);
        },
      ),
      { numRuns: 200 },
    );
  });
});
