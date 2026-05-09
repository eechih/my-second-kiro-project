import { describe, expect, it } from "vitest";
import { parseVariantLabels } from "../variant-labels";

describe("parseVariantLabels", () => {
  it("解析單層規格選項", () => {
    expect(parseVariantLabels("黑，白，藍")).toEqual(["黑", "白", "藍"]);
  });

  it("解析多層規格並產生組合標籤", () => {
    expect(parseVariantLabels("[黑，白/M，L]")).toEqual([
      "黑 M",
      "黑 L",
      "白 M",
      "白 L",
    ]);
  });

  it("去除空白與重複標籤", () => {
    expect(parseVariantLabels(" 黑, 黑 / M ")).toEqual(["黑 M"]);
  });
});
