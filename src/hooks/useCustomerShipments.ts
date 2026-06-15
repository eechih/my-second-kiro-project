import { client } from "@/lib/amplify-client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export type ShipmentStatusFilter = "all" | "received" | "shipped";

export interface CustomerFulfillmentSummary {
  customerId: string;
  customerName: string;
  pendingOrderCount: number;
  pendingItemCount: number;
  shippedOrderCount: number;
  shippedItemCount: number;
  completedOrderCount: number;
  totalOrderCount: number;
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
  "shippedOrderCount",
  "shippedItemCount",
  "completedOrderCount",
  "totalOrderCount",
] as const;

export function sortCustomerShipmentSummaries(
  summaries: readonly CustomerFulfillmentSummary[],
): CustomerFulfillmentSummary[] {
  return [...summaries].sort((a, b) => {
    if (b.totalOrderCount !== a.totalOrderCount) {
      return b.totalOrderCount - a.totalOrderCount;
    }

    const itemCountA = a.pendingItemCount + a.shippedItemCount;
    const itemCountB = b.pendingItemCount + b.shippedItemCount;

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

      const pendingOrderCount = Number(summary["pendingOrderCount"] ?? 0);
      const pendingItemCount = Number(summary["pendingItemCount"] ?? 0);
      const shippedOrderCount = Number(summary["shippedOrderCount"] ?? 0);
      const shippedItemCount = Number(summary["shippedItemCount"] ?? 0);
      const completedOrderCount = Number(summary["completedOrderCount"] ?? 0);
      const totalOrderCount = Number(summary["totalOrderCount"] ?? pendingOrderCount + shippedOrderCount);

      summaries.push({
        customerId,
        customerName: String(
          summary["customerNameSnapshot"] ?? "未命名客戶",
        ),
        pendingOrderCount,
        pendingItemCount,
        shippedOrderCount,
        shippedItemCount,
        completedOrderCount,
        totalOrderCount,
      });
    }

    nextToken = responseNextToken ?? undefined;
  } while (nextToken);

  return sortCustomerShipmentSummaries(summaries);
}

export function useCustomerShipmentSummaries(
  _statusFilter: ShipmentStatusFilter = "all",
): UseQueryResult<CustomerFulfillmentSummary[]> {
  return useQuery({
    queryKey: CUSTOMER_SHIPMENT_KEYS.summaries(),
    queryFn: fetchCustomerShipmentSummaries,
    staleTime: 60_000,
  });
}
