import { describe, expect, it } from "vitest";
import { buildCustomerFulfillmentSummariesFromOrders } from "../customer-fulfillment-summary-lib.mjs";

describe("customer-fulfillment-summary-lib", () => {
  it("excludes cancelled and refunded orders from shipment summary counts", () => {
    const summaries = buildCustomerFulfillmentSummariesFromOrders([
      {
        id: "order-cancelled",
        customerId: "customer-1",
        customerNameSnapshot: "王小明",
        status: "CANCELLED",
        fulfillmentStatus: "UNFULFILLED",
        createdAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
        items: [{ quantity: 2, status: "pending" }],
      },
      {
        id: "order-refunded",
        customerId: "customer-1",
        customerNameSnapshot: "王小明",
        status: "REFUNDED",
        fulfillmentStatus: "COMPLETED",
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
        items: [{ quantity: 1, status: "shipped" }],
      },
      {
        id: "order-ready",
        customerId: "customer-1",
        customerNameSnapshot: "王小明",
        status: "PAID",
        fulfillmentStatus: "READY_TO_SHIP",
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
        items: [
          {
            quantity: 3,
            status: "received",
            receivedAt: "2026-06-12T08:00:00.000Z",
          },
        ],
      },
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      customerId: "customer-1",
      pendingOrderCount: 0,
      pendingItemCount: 0,
      readyToShipOrderCount: 1,
      readyToShipItemCount: 3,
      shippedOrderCount: 0,
      shippedItemCount: 0,
      completedOrderCount: 0,
      totalOrderCount: 1,
      latestReadyToShipReceivedAt: "2026-06-12T08:00:00.000Z",
    });
  });

  it("counts completed orders as shipped and completed", () => {
    const summaries = buildCustomerFulfillmentSummariesFromOrders([
      {
        id: "order-completed",
        customerId: "customer-2",
        customerNameSnapshot: "陳小華",
        status: "COMPLETED",
        fulfillmentStatus: "COMPLETED",
        createdAt: "2026-06-13T00:00:00.000Z",
        updatedAt: "2026-06-13T01:00:00.000Z",
        items: [{ quantity: 2, status: "shipped" }],
      },
    ]);

    expect(summaries[0]).toMatchObject({
      customerId: "customer-2",
      shippedOrderCount: 1,
      shippedItemCount: 2,
      completedOrderCount: 1,
      totalOrderCount: 1,
    });
  });

  it("excludes orphan orders whose customer is not in customer list", () => {
    const summaries = buildCustomerFulfillmentSummariesFromOrders({
      customers: [
        {
          id: "customer-1",
          name: "王小明",
        },
      ],
      orders: [
        {
          id: "order-1",
          customerId: "customer-1",
          customerNameSnapshot: "王小明",
          status: "PAID",
          fulfillmentStatus: "READY_TO_SHIP",
          createdAt: "2026-06-12T00:00:00.000Z",
          updatedAt: "2026-06-12T00:00:00.000Z",
          items: [{ quantity: 1, status: "received", receivedAt: "2026-06-12T08:00:00.000Z" }],
        },
        {
          id: "order-2",
          customerId: "missing-customer",
          customerNameSnapshot: "不存在的客戶",
          status: "PAID",
          fulfillmentStatus: "READY_TO_SHIP",
          createdAt: "2026-06-13T00:00:00.000Z",
          updatedAt: "2026-06-13T00:00:00.000Z",
          items: [{ quantity: 2, status: "received", receivedAt: "2026-06-13T08:00:00.000Z" }],
        },
      ],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.customerId).toBe("customer-1");
    expect(summaries[0]?.readyToShipOrderCount).toBe(1);
  });
});
