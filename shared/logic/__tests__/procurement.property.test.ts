/**
 * 採購驗證邏輯——屬性測試
 *
 * Property 3: 採購成本非負
 *   ∀ quantity >= 0, unitCost >= 0:
 *     calculateProcurementCost(quantity, unitCost) >= 0
 *
 * Property 5: 採購下單驗證一致性
 *   ∀ lineItem where status !== "pending":
 *     validateProcurementOrder(lineItem, validSupplierId, validCost).valid === false
 *
 * Property 6: 取消驗證一致性
 *   ∀ lineItem where status ∈ {"received", "shipped", "out_of_stock"}:
 *     validateProcurementCancel(lineItem).valid === false
 *
 * Additional:
 *   validateProcurementReceive rejects non-"ordered" statuses
 *   validateProcurementCancel accepts "pending" and "ordered"
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
import type { OrderItemStatus } from "../../models/order";

// ---------------------------------------------------------------------------
// 輔助常數與 Arbitrary
// ---------------------------------------------------------------------------

/** fast-check Arbitrary：產生非「待處理」的狀態 */
const nonPendingStatusArb: fc.Arbitrary<OrderItemStatus> =
  fc.constantFrom<OrderItemStatus>(
    "ordered",
    "received",
    "shipped",
    "out_of_stock",
  );

/** fast-check Arbitrary：產生非「已訂購」的狀態 */
const nonOrderedStatusArb: fc.Arbitrary<OrderItemStatus> =
  fc.constantFrom<OrderItemStatus>(
    "pending",
    "received",
    "shipped",
    "out_of_stock",
  );

/** fast-check Arbitrary：產生不可取消的狀態（已收到、已出貨、缺貨） */
const nonCancellableStatusArb: fc.Arbitrary<OrderItemStatus> =
  fc.constantFrom<OrderItemStatus>("received", "shipped", "out_of_stock");

/** fast-check Arbitrary：產生可取消的狀態（待處理、已訂購） */
const cancellableStatusArb: fc.Arbitrary<OrderItemStatus> =
  fc.constantFrom<OrderItemStatus>("pending", "ordered");

/** fast-check Arbitrary：產生非空字串（供應商 ID） */
const nonEmptyStringArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1 })
  .filter((s) => s.trim().length > 0);

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
  it("∀ quantity >= 0, unitCost >= 0: calculateProcurementCost(quantity, unitCost) >= 0", () => {
    fc.assert(
      fc.property(nonNegativeIntArb, nonNegativeFloatArb, (qty, cost) => {
        const result = calculateProcurementCost(qty, cost);
        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  it("計算結果應等於 quantity × unitCost", () => {
    fc.assert(
      fc.property(nonNegativeIntArb, nonNegativeFloatArb, (qty, cost) => {
        const result = calculateProcurementCost(qty, cost);
        expect(result).toBe(qty * cost);
      }),
      { numRuns: 100 },
    );
  });

  it("quantity 為 0 時，成本應為 0", () => {
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
          const result = validateProcurementOrder(
            lineItem,
            supplierId,
            unitCost,
          );
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
          const lineItem = { status: "pending" as const, quantity };
          const result = validateProcurementOrder(
            lineItem,
            supplierId,
            unitCost,
          );
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
// validateProcurementReceive: rejects non-"ordered" statuses
// ---------------------------------------------------------------------------

describe("validateProcurementReceive: rejects non-'已訂購' statuses", () => {
  /**
   * **Validates: Requirements 4.1, 4.8**
   */
  it("∀ lineItem where status !== '已訂購': validateProcurementReceive(lineItem).valid === false", () => {
    fc.assert(
      fc.property(nonOrderedStatusArb, (status) => {
        const lineItem = { status };
        const result = validateProcurementReceive(lineItem);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it("status === '已訂購' 時，驗證應通過", () => {
    const lineItem = { status: "ordered" as const };
    const result = validateProcurementReceive(lineItem);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
