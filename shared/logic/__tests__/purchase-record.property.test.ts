/**
 * 採購記錄狀態轉換與數量守恆——屬性測試
 *
 * 屬性 4：採購記錄狀態轉換——僅允許合法轉換
 *   對所有狀態對 (from, to) 驗證轉換合法性。
 *   特別驗證 received → cancelled 不被允許。
 *
 * 屬性 6：採購數量守恆——累計採購不超過訂單數量
 *   對任意明細項目及其任意序列的採購操作，累計已採購數量應等於所有採購記錄
 *   數量的加總，且任何單次採購的數量不得超過未採購餘額。
 *
 * 驗證需求：6.8, 6.9, 6.2, 6.3
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isValidPurchaseStatusTransition,
  getNextAllowedPurchaseStatuses,
  calculateRemainingPurchaseQuantity,
  validatePurchaseQuantity,
  applyReceived,
} from "../purchase-record";
import type { PurchaseRecordStatus } from "../../models/order";

// ---------------------------------------------------------------------------
// 輔助常數與 Arbitrary
// ---------------------------------------------------------------------------

/** 所有合法的採購記錄狀態值 */
const ALL_PURCHASE_STATUSES: readonly PurchaseRecordStatus[] = [
  "pending",
  "received",
  "cancelled",
] as const;

/**
 * 明確列舉所有合法的狀態轉換對。
 * 允許路徑：pending → received，pending → cancelled
 */
const VALID_TRANSITIONS: ReadonlySet<string> = new Set([
  "pending->received",
  "pending->cancelled",
]);

/** fast-check Arbitrary：產生任意合法的 PurchaseRecordStatus */
const purchaseStatusArb: fc.Arbitrary<PurchaseRecordStatus> = fc.constantFrom(
  ...ALL_PURCHASE_STATUSES,
);

/** fast-check Arbitrary：產生正整數（用於數量） */
const positiveIntArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 10000 });

// ---------------------------------------------------------------------------
// 屬性 4：採購記錄狀態轉換——僅允許合法轉換
// ---------------------------------------------------------------------------

describe("屬性 4：採購記錄狀態轉換——僅允許合法轉換", () => {
  it("對任意狀態對 (from, to)，isValidPurchaseStatusTransition 應與允許轉換集合一致", () => {
    fc.assert(
      fc.property(purchaseStatusArb, purchaseStatusArb, (from, to) => {
        const result = isValidPurchaseStatusTransition(from, to);
        const key = `${from}->${to}`;
        const expected = VALID_TRANSITIONS.has(key);

        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it("任何狀態轉換至自身應不被允許", () => {
    fc.assert(
      fc.property(purchaseStatusArb, (status) => {
        expect(isValidPurchaseStatusTransition(status, status)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("received → cancelled 應不被允許（已入庫記錄無法取消）", () => {
    expect(isValidPurchaseStatusTransition("received", "cancelled")).toBe(
      false,
    );
  });

  it("received 狀態不可轉換至任何其他狀態", () => {
    fc.assert(
      fc.property(purchaseStatusArb, (to) => {
        expect(isValidPurchaseStatusTransition("received", to)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("cancelled 狀態不可轉換至任何其他狀態", () => {
    fc.assert(
      fc.property(purchaseStatusArb, (to) => {
        expect(isValidPurchaseStatusTransition("cancelled", to)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("pending 可轉換至 received 與 cancelled", () => {
    expect(isValidPurchaseStatusTransition("pending", "received")).toBe(true);
    expect(isValidPurchaseStatusTransition("pending", "cancelled")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getNextAllowedPurchaseStatuses 屬性測試
// ---------------------------------------------------------------------------

describe("getNextAllowedPurchaseStatuses 屬性測試", () => {
  it("回傳的每個目標狀態皆應通過 isValidPurchaseStatusTransition 驗證", () => {
    fc.assert(
      fc.property(purchaseStatusArb, (current) => {
        const allowed = getNextAllowedPurchaseStatuses(current);

        for (const target of allowed) {
          expect(isValidPurchaseStatusTransition(current, target)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("不在回傳列表中的狀態皆應被 isValidPurchaseStatusTransition 拒絕", () => {
    fc.assert(
      fc.property(purchaseStatusArb, (current) => {
        const allowed = new Set(getNextAllowedPurchaseStatuses(current));

        for (const status of ALL_PURCHASE_STATUSES) {
          if (!allowed.has(status)) {
            expect(isValidPurchaseStatusTransition(current, status)).toBe(
              false,
            );
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("回傳的目標狀態列表不應包含重複值", () => {
    fc.assert(
      fc.property(purchaseStatusArb, (current) => {
        const allowed = getNextAllowedPurchaseStatuses(current);
        const unique = new Set(allowed);

        expect(allowed.length).toBe(unique.size);
      }),
      { numRuns: 100 },
    );
  });

  it("received 狀態的可轉換列表應為空", () => {
    expect(getNextAllowedPurchaseStatuses("received")).toEqual([]);
  });

  it("cancelled 狀態的可轉換列表應為空", () => {
    expect(getNextAllowedPurchaseStatuses("cancelled")).toEqual([]);
  });

  it("pending 狀態的可轉換列表應包含 received 與 cancelled", () => {
    const allowed = getNextAllowedPurchaseStatuses("pending");
    expect(allowed).toContain("received");
    expect(allowed).toContain("cancelled");
    expect(allowed).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 屬性 6：採購數量守恆——累計採購不超過訂單數量
// ---------------------------------------------------------------------------

describe("屬性 6：採購數量守恆——累計採購不超過訂單數量", () => {
  it("未採購餘額應等於訂單數量減去累計已採購數量", () => {
    fc.assert(
      fc.property(
        positiveIntArb,
        fc.integer({ min: 0, max: 10000 }),
        (orderQty, purchasedQty) => {
          // 確保 purchasedQty 不超過 orderQty
          const capped = Math.min(purchasedQty, orderQty);
          const remaining = calculateRemainingPurchaseQuantity(
            orderQty,
            capped,
          );

          expect(remaining).toBe(orderQty - capped);
          expect(remaining).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("累計已採購數量等於訂單數量時，未採購餘額應為 0", () => {
    fc.assert(
      fc.property(positiveIntArb, (orderQty) => {
        const remaining = calculateRemainingPurchaseQuantity(
          orderQty,
          orderQty,
        );
        expect(remaining).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it("尚未採購時，未採購餘額應等於訂單數量", () => {
    fc.assert(
      fc.property(positiveIntArb, (orderQty) => {
        const remaining = calculateRemainingPurchaseQuantity(orderQty, 0);
        expect(remaining).toBe(orderQty);
      }),
      { numRuns: 100 },
    );
  });

  it("採購數量不超過未採購餘額時，驗證應通過", () => {
    fc.assert(
      fc.property(
        positiveIntArb,
        fc.integer({ min: 0, max: 9999 }),
        (orderQty, purchasedQty) => {
          const capped = Math.min(purchasedQty, orderQty - 1); // 確保至少有 1 的餘額
          const remaining = calculateRemainingPurchaseQuantity(
            orderQty,
            capped,
          );
          // 產生 1 到 remaining 之間的採購數量
          const requestedQty = Math.min(Math.max(1, remaining), remaining);

          const result = validatePurchaseQuantity(requestedQty, remaining);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        },
      ),
      { numRuns: 200 },
    );
  });

  it("採購數量超過未採購餘額時，驗證應失敗", () => {
    fc.assert(
      fc.property(positiveIntArb, positiveIntArb, (remaining, extra) => {
        const requestedQty = remaining + extra; // 一定超過 remaining

        const result = validatePurchaseQuantity(requestedQty, remaining);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 200 },
    );
  });

  it("採購數量為 0 或負數時，驗證應失敗", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 0 }),
        positiveIntArb,
        (requestedQty, remaining) => {
          const result = validatePurchaseQuantity(requestedQty, remaining);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        },
      ),
      { numRuns: 200 },
    );
  });

  it("模擬多次分批採購，累計數量不應超過訂單數量", () => {
    fc.assert(
      fc.property(
        positiveIntArb,
        fc.array(positiveIntArb, { minLength: 1, maxLength: 10 }),
        (orderQty, batchQuantities) => {
          let totalPurchased = 0;

          for (const batchQty of batchQuantities) {
            const remaining = calculateRemainingPurchaseQuantity(
              orderQty,
              totalPurchased,
            );

            if (remaining <= 0) {
              // 已全部採購完畢，後續採購應全部失敗
              const result = validatePurchaseQuantity(batchQty, remaining);
              expect(result.valid).toBe(false);
              continue;
            }

            // 將批次數量限制在餘額內
            const actualQty = Math.min(batchQty, remaining);
            const result = validatePurchaseQuantity(actualQty, remaining);
            expect(result.valid).toBe(true);

            totalPurchased += actualQty;

            // 不變量：累計採購數量永遠不超過訂單數量
            expect(totalPurchased).toBeLessThanOrEqual(orderQty);
          }

          // 最終不變量：累計採購數量不超過訂單數量
          expect(totalPurchased).toBeLessThanOrEqual(orderQty);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("恰好採購完全部餘額後，再次採購任何正數量應失敗", () => {
    fc.assert(
      fc.property(positiveIntArb, positiveIntArb, (orderQty, extraQty) => {
        // 先全部採購完畢
        const remaining = calculateRemainingPurchaseQuantity(
          orderQty,
          orderQty,
        );
        expect(remaining).toBe(0);

        // 再次採購應失敗
        const result = validatePurchaseQuantity(extraQty, remaining);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// applyReceived 屬性測試（入庫增加庫存）
// ---------------------------------------------------------------------------

describe("applyReceived 屬性測試（入庫增加庫存）", () => {
  it("入庫後庫存應等於原庫存加上入庫數量", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        positiveIntArb,
        (stock, receivedQty) => {
          const newStock = applyReceived(stock, receivedQty);
          expect(newStock).toBe(stock + receivedQty);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("入庫後庫存應嚴格大於原庫存（入庫數量 > 0）", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        positiveIntArb,
        (stock, receivedQty) => {
          const newStock = applyReceived(stock, receivedQty);
          expect(newStock).toBeGreaterThan(stock);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("入庫數量為 0 時庫存不變", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), (stock) => {
        const newStock = applyReceived(stock, 0);
        expect(newStock).toBe(stock);
      }),
      { numRuns: 100 },
    );
  });

  it("多次入庫的結果應等於一次入庫總量（結合律）", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        positiveIntArb,
        positiveIntArb,
        (stock, qty1, qty2) => {
          // 分兩次入庫
          const afterFirst = applyReceived(stock, qty1);
          const afterSecond = applyReceived(afterFirst, qty2);

          // 一次入庫總量
          const atOnce = applyReceived(stock, qty1 + qty2);

          expect(afterSecond).toBe(atOnce);
        },
      ),
      { numRuns: 200 },
    );
  });
});
