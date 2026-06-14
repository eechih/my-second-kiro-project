import { describe, expect, it } from "vitest";
import { buildCustomerShipmentSummaries } from "./useCustomerShipments";

describe("buildCustomerShipmentSummaries", () => {
  it("aggregates pending and shipped quantities with distinct orders by customer", () => {
    const summaries = buildCustomerShipmentSummaries([
      {
        customerId: "customer-1",
        customerName: "王小明",
        orderId: "order-1",
        quantity: 2,
        status: "received",
      },
      {
        customerId: "customer-1",
        customerName: "王小明",
        orderId: "order-1",
        quantity: 3,
        status: "received",
      },
      {
        customerId: "customer-1",
        customerName: "王小明",
        orderId: "order-2",
        quantity: 1,
        status: "shipped",
      },
      {
        customerId: "customer-2",
        customerName: "陳小華",
        orderId: "order-3",
        quantity: 4,
        status: "shipped",
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
        customerName: "陳小華",
        pendingOrderCount: 0,
        pendingItemCount: 0,
        shippedOrderCount: 1,
        shippedItemCount: 4,
        totalOrderCount: 1,
        totalItemCount: 4,
      },
    ]);
  });
});
