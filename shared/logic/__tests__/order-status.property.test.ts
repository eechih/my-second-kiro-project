/**
 * 訂單狀態轉換——屬性測試
 *
 * 屬性 2：訂單狀態轉換——僅允許合法轉換
 * 對所有狀態對 (from, to) 驗證轉換合法性。
 *
 * 驗證需求：5.2, 5.3
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isValidOrderStatusTransition,
  getNextAllowedOrderStatuses,
} from "../order-status";
import type { OrderStatus } from "../../models/order";

// ---------------------------------------------------------------------------
// 輔助常數
// ---------------------------------------------------------------------------

/** 所有合法的訂單狀態值 */
const ALL_ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CANCELLED",
  "REFUNDED",
  "COMPLETED",
] as const;

/**
 * 明確列舉所有合法的狀態轉換對。
 * 允許路徑：PENDING_PAYMENT → PAID → COMPLETED；PENDING_PAYMENT/PAID/COMPLETED 可進 CANCELLED/REFUNDED
 */
const VALID_TRANSITIONS: ReadonlySet<string> = new Set([
  "PENDING_PAYMENT->PAID",
  "PENDING_PAYMENT->CANCELLED",
  "PAID->COMPLETED",
  "PAID->REFUNDED",
  "PAID->CANCELLED",
  "COMPLETED->REFUNDED",
]);

/** fast-check Arbitrary：產生任意合法的 OrderStatus */
const orderStatusArb: fc.Arbitrary<OrderStatus> = fc.constantFrom(
  ...ALL_ORDER_STATUSES,
);

// ---------------------------------------------------------------------------
// 屬性測試
// ---------------------------------------------------------------------------

describe("屬性 2：訂單狀態轉換——僅允許合法轉換", () => {
  it("對任意狀態對 (from, to)，isValidOrderStatusTransition 應與允許轉換集合一致", () => {
    fc.assert(
      fc.property(orderStatusArb, orderStatusArb, (from, to) => {
        const result = isValidOrderStatusTransition(from, to);
        const key = `${from}->${to}`;
        const expected = VALID_TRANSITIONS.has(key);

        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it("任何狀態轉換至自身應不被允許", () => {
    fc.assert(
      fc.property(orderStatusArb, (status) => {
        expect(isValidOrderStatusTransition(status, status)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("CANCELLED 狀態不可轉換至任何其他狀態", () => {
    fc.assert(
      fc.property(orderStatusArb, (to) => {
        expect(isValidOrderStatusTransition("CANCELLED", to)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("PENDING_PAYMENT 與 PAID 可轉換至 CANCELLED", () => {
    const nonCancelledArb = fc.constantFrom<OrderStatus>(
      "PENDING_PAYMENT",
      "PAID",
    );

    fc.assert(
      fc.property(nonCancelledArb, (from) => {
        expect(isValidOrderStatusTransition(from, "CANCELLED")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("正向路徑 PENDING_PAYMENT → PAID → COMPLETED 每一步皆合法", () => {
    const happyPath: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "COMPLETED"];

    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(
        isValidOrderStatusTransition(happyPath[i]!, happyPath[i + 1]!),
      ).toBe(true);
    }
  });

  it("不允許反向轉換（COMPLETED → PAID → PENDING_PAYMENT）", () => {
    const reversePath: OrderStatus[] = [
      "COMPLETED",
      "PAID",
      "PENDING_PAYMENT",
    ];

    for (let i = 0; i < reversePath.length - 1; i++) {
      expect(
        isValidOrderStatusTransition(reversePath[i]!, reversePath[i + 1]!),
      ).toBe(false);
    }
  });

  it("不允許跳躍轉換（PENDING_PAYMENT → COMPLETED）", () => {
    expect(isValidOrderStatusTransition("PENDING_PAYMENT", "COMPLETED")).toBe(
      false,
    );
    expect(isValidOrderStatusTransition("PENDING_PAYMENT", "REFUNDED")).toBe(
      false,
    );
    expect(isValidOrderStatusTransition("COMPLETED", "CANCELLED")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getNextAllowedOrderStatuses 屬性測試
// ---------------------------------------------------------------------------

describe("getNextAllowedOrderStatuses 屬性測試", () => {
  it("回傳的每個目標狀態皆應通過 isValidOrderStatusTransition 驗證", () => {
    fc.assert(
      fc.property(orderStatusArb, (current) => {
        const allowed = getNextAllowedOrderStatuses(current);

        for (const target of allowed) {
          expect(isValidOrderStatusTransition(current, target)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("不在回傳列表中的狀態皆應被 isValidOrderStatusTransition 拒絕", () => {
    fc.assert(
      fc.property(orderStatusArb, (current) => {
        const allowed = new Set(getNextAllowedOrderStatuses(current));

        for (const status of ALL_ORDER_STATUSES) {
          if (!allowed.has(status)) {
            expect(isValidOrderStatusTransition(current, status)).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("回傳的目標狀態列表不應包含重複值", () => {
    fc.assert(
      fc.property(orderStatusArb, (current) => {
        const allowed = getNextAllowedOrderStatuses(current);
        const unique = new Set(allowed);

        expect(allowed.length).toBe(unique.size);
      }),
      { numRuns: 100 },
    );
  });

  it("CANCELLED 狀態的可轉換列表應為空", () => {
    const allowed = getNextAllowedOrderStatuses("CANCELLED");
    expect(allowed).toEqual([]);
  });
});
