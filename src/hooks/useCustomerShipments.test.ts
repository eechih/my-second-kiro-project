import { describe, expect, it } from "vitest";
import { buildPendingShipmentCustomerSummaries } from "./useCustomerShipments";

describe("buildPendingShipmentCustomerSummaries", () => {
  it("aggregates pending item quantities and distinct orders by customer", () => {
    const summaries = buildPendingShipmentCustomerSummaries([
      {
        customerId: "customer-1",
        customerName: "王小明",
        orderId: "order-1",
        quantity: 2,
      },
      {
        customerId: "customer-1",
        customerName: "王小明",
        orderId: "order-1",
        quantity: 3,
      },
      {
        customerId: "customer-1",
        customerName: "王小明",
        orderId: "order-2",
        quantity: 1,
      },
      {
        customerId: "customer-2",
        customerName: "陳小華",
        orderId: "order-3",
        quantity: 4,
      },
    ]);

    expect(summaries).toEqual([
      {
        customerId: "customer-1",
        customerName: "王小明",
        pendingOrderCount: 2,
        pendingItemCount: 6,
      },
      {
        customerId: "customer-2",
        customerName: "陳小華",
        pendingOrderCount: 1,
        pendingItemCount: 4,
      },
    ]);
  });
});
