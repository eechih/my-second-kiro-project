import { client } from "@/lib/amplify-client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export type ShipmentStatusFilter =
  | "all"
  | "pending"
  | "readyToShip"
  | "shipped";

export interface CustomerFulfillmentSummary {
  customerId: string;
  customerName: string;
  pendingOrderCount: number;
  pendingItemCount: number;
  readyToShipOrderCount: number;
  readyToShipItemCount: number;
  shippedOrderCount: number;
  shippedItemCount: number;
  completedOrderCount: number;
  totalOrderCount: number;
  latestReadyToShipReceivedAt?: string;
}

const CUSTOMER_SHIPMENT_KEYS = {
  all: ["customer-shipments"] as const,
  summaries: () => [...CUSTOMER_SHIPMENT_KEYS.all, "summaries"] as const,
};

const CUSTOMER_FULFILLMENT_SUMMARY_SELECTION_SET = [
  "id",
  "customerId",
  "customerNameSnapshot",
  "pendingOrderCount",
  "pendingItemCount",
  "readyToShipOrderCount",
  "readyToShipItemCount",
  "latestReadyToShipReceivedAt",
  "shippedOrderCount",
  "shippedItemCount",
  "completedOrderCount",
  "totalOrderCount",
] as const;

export function sortCustomerShipmentSummaries(
  summaries: readonly CustomerFulfillmentSummary[],
  statusFilter: ShipmentStatusFilter = "all",
): CustomerFulfillmentSummary[] {
  return [...summaries].sort((a, b) => {
    if (statusFilter === "readyToShip" || statusFilter === "all") {
      const timeA = a.latestReadyToShipReceivedAt
        ? Date.parse(a.latestReadyToShipReceivedAt)
        : Number.NEGATIVE_INFINITY;
      const timeB = b.latestReadyToShipReceivedAt
        ? Date.parse(b.latestReadyToShipReceivedAt)
        : Number.NEGATIVE_INFINITY;

      if (timeB !== timeA) {
        return timeB - timeA;
      }
    }

    if (b.totalOrderCount !== a.totalOrderCount) {
      return b.totalOrderCount - a.totalOrderCount;
    }

    const itemCountA =
      a.pendingItemCount + a.readyToShipItemCount + a.shippedItemCount;
    const itemCountB =
      b.pendingItemCount + b.readyToShipItemCount + b.shippedItemCount;

    if (itemCountB !== itemCountA) {
      return itemCountB - itemCountA;
    }

    return a.customerName.localeCompare(b.customerName, "zh-Hant");
  });
}

async function fetchCustomerShipmentSummaries(): Promise<
  CustomerFulfillmentSummary[]
> {
  const summaries: CustomerFulfillmentSummary[] = [];
  let nextToken: string | undefined;

  do {
    const response =
      await client.models.CustomerFulfillmentSummary.listCustomerFulfillmentSummariesByCreatedDate(
        { gsiPartition: "CustomerFulfillmentSummary" },
        {
          limit: 1000,
          sortDirection: "DESC",
          ...(nextToken ? { nextToken } : {}),
          selectionSet: CUSTOMER_FULFILLMENT_SUMMARY_SELECTION_SET,
        } as Record<string, unknown>,
      );

    const { data, errors, nextToken: responseNextToken } = response;

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "查詢客戶出貨摘要失敗");
    }

    for (const rawSummary of data ?? []) {
      const summary = rawSummary as unknown as Record<string, unknown>;
      const customerId = String(summary["customerId"] ?? summary["id"] ?? "");

      if (!customerId) {
        continue;
      }

      summaries.push({
        customerId,
        customerName: String(summary["customerNameSnapshot"] ?? "未命名客戶"),
        pendingOrderCount: Number(summary["pendingOrderCount"] ?? 0),
        pendingItemCount: Number(summary["pendingItemCount"] ?? 0),
        readyToShipOrderCount: Number(summary["readyToShipOrderCount"] ?? 0),
        readyToShipItemCount: Number(summary["readyToShipItemCount"] ?? 0),
        latestReadyToShipReceivedAt:
          summary["latestReadyToShipReceivedAt"] != null
            ? String(summary["latestReadyToShipReceivedAt"])
            : undefined,
        shippedOrderCount: Number(summary["shippedOrderCount"] ?? 0),
        shippedItemCount: Number(summary["shippedItemCount"] ?? 0),
        completedOrderCount: Number(summary["completedOrderCount"] ?? 0),
        totalOrderCount: Number(summary["totalOrderCount"] ?? 0),
      });
    }

    nextToken = responseNextToken ?? undefined;
  } while (nextToken);

  return summaries;
}

export function useCustomerShipmentSummaries(
  statusFilter: ShipmentStatusFilter = "all",
): UseQueryResult<CustomerFulfillmentSummary[]> {
  return useQuery({
    queryKey: [...CUSTOMER_SHIPMENT_KEYS.summaries(), statusFilter],
    queryFn: fetchCustomerShipmentSummaries,
    select: (summaries) =>
      sortCustomerShipmentSummaries(summaries, statusFilter),
    staleTime: 60_000,
  });
}
