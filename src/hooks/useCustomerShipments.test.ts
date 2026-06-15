import { describe, expect, it } from "vitest";
import { sortCustomerShipmentSummaries } from "./useCustomerShipments";

describe("sortCustomerShipmentSummaries", () => {
  it("sorts by total orders, then total items, then customer name", () => {
    const summaries = sortCustomerShipmentSummaries([
      {
        customerId: "customer-3",
        customerName: "陳小華",
        pendingOrderCount: 1,
        pendingItemCount: 2,
        shippedOrderCount: 0,
        shippedItemCount: 0,
        totalOrderCount: 1,
        totalItemCount: 2,
      },
      {
        customerId: "customer-1",
        customerName: "王小明",
        pendingOrderCount: 1,
        pendingItemCount: 5,
        shippedOrderCount: 1,
        shippedItemCount: 1,
        totalOrderCount: 2,
        totalItemCount: 6,
      },
      {
        customerId: "customer-2",
        customerName: "李小華",
        pendingOrderCount: 1,
        pendingItemCount: 2,
        shippedOrderCount: 0,
        shippedItemCount: 0,
        totalOrderCount: 1,
        totalItemCount: 2,
      },
    ]);

    expect(summaries).toEqual([
      {
        customerId: "customer-1",
        customerName: "王小明",
        pendingOrderCount: 1,
        pendingItemCount: 5,
        shippedOrderCount: 1,
        shippedItemCount: 1,
        totalOrderCount: 2,
        totalItemCount: 6,
      },
      {
        customerId: "customer-2",
        customerName: "李小華",
        pendingOrderCount: 1,
        pendingItemCount: 2,
        shippedOrderCount: 0,
        shippedItemCount: 0,
        totalOrderCount: 1,
        totalItemCount: 2,
      },
      {
        customerId: "customer-3",
        customerName: "陳小華",
        pendingOrderCount: 1,
        pendingItemCount: 2,
        shippedOrderCount: 0,
        shippedItemCount: 0,
        totalOrderCount: 1,
        totalItemCount: 2,
      },
    ]);
  });
});
