import type { Order } from "@shared/models";
import { describe, expect, it } from "vitest";
import { buildPackingSlipHtml } from "./packingSlip";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNumber: "ORD-001",
    customerId: "customer-1",
    customerName: "王小明 & Co",
    status: "shipping",
    statusHistory: [],
    totalAmount: 1200,
    createdAt: "2026-05-14T01:23:00.000Z",
    updatedAt: "2026-05-14T01:23:00.000Z",
    lineItems: [
      {
        id: "item-1",
        productId: "product-1",
        productName: "襯衫 <白>",
        variantLabel: 'M "標準"',
        quantity: 2,
        unitPrice: 600,
        subtotal: 1200,
        status: "shipped",
        purchasedAt: null,
        receivedAt: null,
        shippedAt: "2026-05-14T02:30:00.000Z",
        outOfStockAt: null,
        supplierName: null,
        unitCost: null,
      },
    ],
    ...overrides,
  };
}

describe("buildPackingSlipHtml", () => {
  it("為每筆訂單產生一張出貨單", () => {
    const html = buildPackingSlipHtml([
      makeOrder(),
      makeOrder({ id: "order-2", orderNumber: "ORD-002" }),
    ]);

    expect(html.match(/<section class="slip">/g)).toHaveLength(2);
    expect(html).toContain("ORD-001");
    expect(html).toContain("ORD-002");
  });

  it("轉義訂單與商品文字中的 HTML 特殊字元", () => {
    const html = buildPackingSlipHtml([makeOrder()]);

    expect(html).toContain("王小明 &amp; Co");
    expect(html).toContain("襯衫 &lt;白&gt; (M &quot;標準&quot;)");
  });

  it("未勾選出貨品項時顯示沒有商品需要出貨", () => {
    const html = buildPackingSlipHtml([
      makeOrder({
        lineItems: [
          {
            id: "item-1",
            productId: "product-1",
            productName: "襯衫",
            variantLabel: null,
            quantity: 1,
            unitPrice: 500,
            subtotal: 500,
            status: "received",
            purchasedAt: null,
            receivedAt: "2026-05-14T02:00:00.000Z",
            shippedAt: null,
            outOfStockAt: null,
            supplierName: null,
            unitCost: null,
          },
        ],
      }),
    ]);

    expect(html).toContain("沒有商品需要出貨");
    expect(html).toContain("品項數：0");
    expect(html).toContain("總數量：0");
  });

  it("訂單金額依撿貨明細小計重新計算", () => {
    const html = buildPackingSlipHtml([
      makeOrder({
        totalAmount: 1700,
        lineItems: [
          {
            id: "item-1",
            productId: "product-1",
            productName: "襯衫",
            variantLabel: null,
            quantity: 2,
            unitPrice: 600,
            subtotal: 1200,
            status: "shipped",
            purchasedAt: null,
            receivedAt: null,
            shippedAt: "2026-05-14T02:30:00.000Z",
            outOfStockAt: null,
            supplierName: null,
            unitCost: null,
          },
          {
            id: "item-2",
            productId: "product-2",
            productName: "外套",
            variantLabel: null,
            quantity: 1,
            unitPrice: 500,
            subtotal: 500,
            status: "received",
            purchasedAt: null,
            receivedAt: "2026-05-14T02:00:00.000Z",
            shippedAt: null,
            outOfStockAt: null,
            supplierName: null,
            unitCost: null,
          },
        ],
      }),
    ]);

    expect(html).toContain("訂單金額：$1,200");
    expect(html).not.toContain("訂單金額：$1,700");
  });
});
