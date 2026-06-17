import { describe, expect, it } from "vitest";
import { sortCustomerShipmentSummaries } from "./useCustomerShipments";

describe("sortCustomerShipmentSummaries", () => {
  it("sorts ready-to-ship customers by latest received time first", () => {
    const summaries = sortCustomerShipmentSummaries(
      [
        {
          customerId: "customer-3",
          customerName: "陳小華",
          readyToShipOrderCount: 1,
          receivedItemCount: 2,
          latestReceivedAt: "2026-06-10T08:00:00.000Z",
          completedOrderCount: 0,
          totalOrderCount: 1,
        },
        {
          customerId: "customer-1",
          customerName: "王小明",
          readyToShipOrderCount: 1,
          receivedItemCount: 5,
          latestReceivedAt: "2026-06-12T08:00:00.000Z",
          completedOrderCount: 1,
          totalOrderCount: 2,
        },
        {
          customerId: "customer-2",
          customerName: "李小華",
          readyToShipOrderCount: 1,
          receivedItemCount: 2,
          latestReceivedAt: "2026-06-11T08:00:00.000Z",
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
        readyToShipOrderCount: 0,
        receivedItemCount: 0,
        completedOrderCount: 1,
        totalOrderCount: 2,
      },
      {
        customerId: "customer-3",
        customerName: "陳小華",
        readyToShipOrderCount: 0,
        receivedItemCount: 0,
        completedOrderCount: 0,
        totalOrderCount: 1,
      },
      {
        customerId: "customer-2",
        customerName: "李小華",
        readyToShipOrderCount: 0,
        receivedItemCount: 0,
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
