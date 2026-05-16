import { describe, expect, it } from "vitest";
import {
  isTranslationSupplier,
  parseBracketOptions,
  parseSlashOptions,
  parseSupplierTranslationPost,
} from "../translation-parser";

describe("translation parser", () => {
  it("解析括號與斜線規格選項", () => {
    expect(parseBracketOptions("款式：[紅,藍／S，M]")).toEqual([
      ["紅", "藍"],
      ["S", "M"],
    ]);
    expect(parseSlashOptions("紅／藍@S/M")).toEqual([
      ["紅", "藍"],
      ["S", "M"],
    ]);
  });

  it("判斷支援的供應商", () => {
    expect(isTranslationSupplier("wish")).toBe(true);
    expect(isTranslationSupplier("unknown")).toBe(false);
  });

  it("解析 wish 供應商貼文", () => {
    const result = parseSupplierTranslationPost(
      "wish",
      [
        "01/05收單預購 測試保溫杯 12A",
        "建議售價：$390",
        "NT250",
        "款式：[紅,藍／大，小]",
        "商品容量 500ml",
        "01/05收單",
      ].join("\n"),
    );

    expect(result).toMatchObject({
      supplier: "wish",
      name: "測試保溫杯",
      price: 390,
      cost: 250,
      option: [
        ["紅", "藍"],
        ["大", "小"],
      ],
      description: "商品容量 500ml",
    });
    expect(result.dueDate).toContain("-01-05T");
  });

  it("解析 boom p4 供應商貼文並計算建議成本與售價", () => {
    const result = parseSupplierTranslationPost(
      "boom_p4",
      [
        "1234 測試收納盒",
        "批300",
        "款式：[白／黑]",
        "材質厚實",
        "01／05 晚上8點收單",
      ].join("\n"),
    );

    expect(result).toMatchObject({
      supplier: "boom",
      name: "1234 測試收納盒",
      cost: 320,
      price: 400,
      option: [["白"], ["黑"]],
      description: "材質厚實",
    });
  });
});
