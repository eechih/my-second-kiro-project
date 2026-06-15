import { describe, expect, it } from "vitest";
import { sortCustomerShipmentSummaries } from "./useCustomerShipments";

describe("sortCustomerShipmentSummaries", () => {
  it("sorts ready-to-ship customers by latest received time first", () => {
    const summaries = sortCustomerShipmentSummaries(
      [
        {
          customerId: "customer-3",
          customerName: "陳小華",
          pendingOrderCount: 0,
          pendingItemCount: 0,
          readyToShipOrderCount: 1,
          readyToShipItemCount: 2,
          latestReadyToShipReceivedAt: "2026-06-10T08:00:00.000Z",
          shippedOrderCount: 0,
          shippedItemCount: 0,
          completedOrderCount: 0,
          totalOrderCount: 1,
        },
        {
          customerId: "customer-1",
          customerName: "王小明",
          pendingOrderCount: 0,
          pendingItemCount: 0,
          readyToShipOrderCount: 1,
          readyToShipItemCount: 5,
          latestReadyToShipReceivedAt: "2026-06-12T08:00:00.000Z",
          shippedOrderCount: 1,
          shippedItemCount: 1,
          completedOrderCount: 1,
          totalOrderCount: 2,
        },
        {
          customerId: "customer-2",
          customerName: "李小華",
          pendingOrderCount: 0,
          pendingItemCount: 0,
          readyToShipOrderCount: 1,
          readyToShipItemCount: 2,
          latestReadyToShipReceivedAt: "2026-06-11T08:00:00.000Z",
          shippedOrderCount: 0,
          shippedItemCount: 0,
          completedOrderCount: 0,
          totalOrderCount: 1,
        },
      ],
      "readyToShip",
    );

    expect(summaries.map((summary) => summary.customerId)).toEqual([
      "customer-1",
      "customer-2",
      "customer-3",
    ]);
  });

  it("falls back to total orders, items, then customer name", () => {
    const summaries = sortCustomerShipmentSummaries([
      {
        customerId: "customer-1",
        customerName: "王小明",
        pendingOrderCount: 1,
        pendingItemCount: 5,
        readyToShipOrderCount: 0,
        readyToShipItemCount: 0,
        shippedOrderCount: 1,
        shippedItemCount: 1,
        completedOrderCount: 1,
        totalOrderCount: 2,
      },
      {
        customerId: "customer-3",
        customerName: "陳小華",
        pendingOrderCount: 1,
        pendingItemCount: 2,
        readyToShipOrderCount: 0,
        readyToShipItemCount: 0,
        shippedOrderCount: 0,
        shippedItemCount: 0,
        completedOrderCount: 0,
        totalOrderCount: 1,
      },
      {
        customerId: "customer-2",
        customerName: "李小華",
        pendingOrderCount: 1,
        pendingItemCount: 2,
        readyToShipOrderCount: 0,
        readyToShipItemCount: 0,
        shippedOrderCount: 0,
        shippedItemCount: 0,
        completedOrderCount: 0,
        totalOrderCount: 1,
      },
    ]);

    expect(summaries.map((summary) => summary.customerId)).toEqual([
      "customer-1",
      "customer-2",
      "customer-3",
    ]);
  });
});
