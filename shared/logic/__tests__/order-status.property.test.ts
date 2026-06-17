import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  getNextAllowedOrderStatuses,
  isValidOrderStatusTransition,
} from "../order-status";
import type { OrderStatus } from "../../models/order";

const ALL_ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "ORDERED",
  "RECEIVED",
  "SHIPPED",
  "COMPLETED",
  "OUT_OF_STOCK",
  "CANCELLED",
] as const;

const VALID_TRANSITIONS: ReadonlySet<string> = new Set([
  "PENDING->CANCELLED",
  "ORDERED->CANCELLED",
  "RECEIVED->CANCELLED",
  "SHIPPED->COMPLETED",
  "OUT_OF_STOCK->CANCELLED",
]);

const orderStatusArb: fc.Arbitrary<OrderStatus> = fc.constantFrom(
  ...ALL_ORDER_STATUSES,
);

describe("order-status", () => {
  it("合法轉換集合應與驗證函式一致", () => {
    fc.assert(
      fc.property(orderStatusArb, orderStatusArb, (from, to) => {
        expect(isValidOrderStatusTransition(from, to)).toBe(
          VALID_TRANSITIONS.has(`${from}->${to}`),
        );
      }),
    );
  });

  it("同狀態不可轉換到自己", () => {
    fc.assert(
      fc.property(orderStatusArb, (status) => {
        expect(isValidOrderStatusTransition(status, status)).toBe(false);
      }),
    );
  });

  it("CANCELLED 不可轉到任何其他狀態", () => {
    fc.assert(
      fc.property(orderStatusArb, (target) => {
        expect(isValidOrderStatusTransition("CANCELLED", target)).toBe(false);
      }),
    );
  });

  it("getNextAllowedOrderStatuses 應與驗證函式一致", () => {
    fc.assert(
      fc.property(orderStatusArb, (current) => {
        const allowed = new Set(getNextAllowedOrderStatuses(current));
        for (const status of ALL_ORDER_STATUSES) {
          expect(allowed.has(status)).toBe(
            isValidOrderStatusTransition(current, status),
          );
        }
      }),
    );
  });
});
