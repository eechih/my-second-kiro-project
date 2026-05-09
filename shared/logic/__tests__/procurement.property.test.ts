/**
 * 採購驗證邏輯——屬性測試
 *
 * Property 3: 採購成本非負
 *   ∀ purchasedQuantity >= 0, unitCost >= 0:
 *     calculateProcurementCost(purchasedQuantity, unitCost) >= 0
 *
 * Property 5: 採購下單驗證一致性
 *   ∀ lineItem where status !== "待處理":
 *     validateProcurementOrder(lineItem, validSupplierId, validCost).valid === false
 *
 * Property 6: 取消驗證一致性
 *   ∀ lineItem where status ∈ {"已收到", "已出貨", "缺貨"}:
 *     validateProcurementCancel(lineItem).valid === false
 *
 * Additional:
 *   validateProcurementReceive rejects non-"已訂購" statuses
 *   validateProcurementCancel accepts "待處理" and "已訂購"
 *
 * **Validates: Requirements 3.8, 4.8, 5.5, 6.1, 6.4**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  calculateProcurementCost,
  validateProcurementOrder,
  validateProcurementReceive,
  validateProcurementCancel,
} from "../procurement";
import type { LineItemStatus } from "../../models/order";

// ---------------------------------------------------------------------------
// 輔助常數與 Arbitrary
// ---------------------------------------------------------------------------

/** fast-check Arbitrary：產生非「待處理」的狀態 */
const nonPendingStatusArb: fc.Arbitrary<LineItemStatus> = fc.constantFrom<LineItemStatus>(
  "已訂購",
  "已收到",
  "已出貨",
  "缺貨",
);

/** fast-check Arbitrary：產生非「已訂購」的狀態 */
const nonOrderedStatusArb: fc.Arbitrary<LineItemStatus> = fc.constantFrom<LineItemStatus>(
  "待處理",
  "已收到",
  "已出貨",
  "缺貨",
);

/** fast-check Arbitrary：產生不可取消的狀態（已收到、已出貨、缺貨） */
const nonCancellableStatusArb: fc.Arbitrary<LineItemStatus> = fc.constantFrom<LineItemStatus>(
  "已收到",
  "已出貨",
  "缺貨",
);

/** fast-check Arbitrary：產生可取消的狀態（待處理、已訂購） */
const cancellableStatusArb: fc.Arbitrary<LineItemStatus> = fc.constantFrom<LineItemStatus>(
  "待處理",
  "已訂購",
);

/** fast-check Arbitrary：產生非空字串（供應商 ID） */
const nonEmptyStringArb: fc.Arbitrary<string> = fc.string({ minLength: 1 }).filter(
  (s) => s.trim().length > 0,
);

/** fast-check Arbitrary：產生非負浮點數 */
const nonNegativeFloatArb: fc.Arbitrary<number> = fc.float({
  min: 0,
  max: 1_000_000,
  noNaN: true,
});

/** fast-check Arbitrary：產生非負整數 */
const nonNegativeIntArb: fc.Arbitrary<number> = fc.nat({ max: 100_000 });

// ---------------------------------------------------------------------------
// Property 3: 採購成本非負
// ---------------------------------------------------------------------------

describe("Property 3: 採購成本非負", () => {
  /**
   * **Validates: Requirements 6.1, 6.4**
   */
  it("∀ purchasedQuantity >= 0, unitCost >= 0: calculateProcurementCost(purchasedQuantity, unitCost) >= 0", () => {
    fc.assert(
      fc.property(nonNegativeIntArb, nonNegativeFloatArb, (qty, cost) => {
        const result = calculateProcurementCost(qty, cost);
        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  it("計算結果應等於 purchasedQuantity × unitCost", () => {
    fc.assert(
      fc.property(nonNegativeIntArb, nonNegativeFloatArb, (qty, cost) => {
        const result = calculateProcurementCost(qty, cost);
        expect(result).toBe(qty * cost);
      }),
      { numRuns: 100 },
    );
  });

  it("purchasedQuantity 為 0 時，成本應為 0", () => {
    fc.assert(
      fc.property(nonNegativeFloatArb, (cost) => {
        const result = calculateProcurementCost(0, cost);
        expect(result).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it("unitCost 為 0 時，成本應為 0", () => {
    fc.assert(
      fc.property(nonNegativeIntArb, (qty) => {
        const result = calculateProcurementCost(qty, 0);
        expect(result).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: 採購下單驗證一致性
// ---------------------------------------------------------------------------

describe("Property 5: 採購下單驗證一致性", () => {
  /**
   * **Validates: Requirements 3.1, 3.8**
   */
  it("∀ lineItem where status !== '待處理': validateProcurementOrder(lineItem, validSupplierId, validCost).valid === false", () => {
    fc.assert(
      fc.property(
        nonPendingStatusArb,
        nonEmptyStringArb,
        nonNegativeFloatArb,
        (status, supplierId, unitCost) => {
          const lineItem = { status, quantity: 10 };
          const result = validateProcurementOrder(lineItem, supplierId, unitCost);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("status === '待處理' 且 supplierId 非空且 unitCost >= 0 時，驗證應通過", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonNegativeFloatArb,
        fc.integer({ min: 1, max: 10000 }),
        (supplierId, unitCost, quantity) => {
          const lineItem = { status: "待處理" as const, quantity };
          const result = validateProcurementOrder(lineItem, supplierId, unitCost);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: 取消驗證一致性
// ---------------------------------------------------------------------------

describe("Property 6: 取消驗證一致性", () => {
  /**
   * **Validates: Requirements 5.2, 5.5**
   */
  it("∀ lineItem where status ∈ {'已收到', '已出貨', '缺貨'}: validateProcurementCancel(lineItem).valid === false", () => {
    fc.assert(
      fc.property(nonCancellableStatusArb, (status) => {
        const result = validateProcurementCancel({ status });
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it("∀ lineItem where status ∈ {'待處理', '已訂購'}: validateProcurementCancel(lineItem).valid === true", () => {
    fc.assert(
      fc.property(cancellableStatusArb, (status) => {
        const result = validateProcurementCancel({ status });
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// validateProcurementReceive: rejects non-"已訂購" statuses
// ---------------------------------------------------------------------------

describe("validateProcurementReceive: rejects non-'已訂購' statuses", () => {
  /**
   * **Validates: Requirements 4.1, 4.8**
   */
  it("∀ lineItem where status !== '已訂購': validateProcurementReceive(lineItem).valid === false", () => {
    fc.assert(
      fc.property(
        nonOrderedStatusArb,
        fc.integer({ min: 1, max: 10000 }),
        (status, purchasedQuantity) => {
          const lineItem = { status, purchasedQuantity };
          const result = validateProcurementReceive(lineItem);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("status === '已訂購' 且 purchasedQuantity > 0 時，驗證應通過", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10000 }), (purchasedQuantity) => {
        const lineItem = { status: "已訂購" as const, purchasedQuantity };
        const result = validateProcurementReceive(lineItem);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
