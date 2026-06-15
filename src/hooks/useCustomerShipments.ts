import { client } from "@/lib/amplify-client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export type ShipmentStatusFilter = "all" | "received" | "shipped";

export interface CustomerShipmentSummary {
  customerId: string;
  customerName: string;
  pendingOrderCount: number;
  pendingItemCount: number;
  shippedOrderCount: number;
  shippedItemCount: number;
  totalOrderCount: number;
  totalItemCount: number;
}

const CUSTOMER_SHIPMENT_KEYS = {
  all: ["customer-shipments"] as const,
  summaries: () => [...CUSTOMER_SHIPMENT_KEYS.all, "summaries"] as const,
};

const CUSTOMER_SHIPMENT_SUMMARY_SELECTION_SET = [
  "id",
  "customerId",
  "customerNameSnapshot",
  "pendingOrderCount",
  "pendingItemCount",
  "shippedOrderCount",
  "shippedItemCount",
] as const;

export function sortCustomerShipmentSummaries(
  summaries: readonly CustomerShipmentSummary[],
): CustomerShipmentSummary[] {
  return [...summaries].sort((a, b) => {
    if (b.totalOrderCount !== a.totalOrderCount) {
      return b.totalOrderCount - a.totalOrderCount;
    }

    if (b.totalItemCount !== a.totalItemCount) {
      return b.totalItemCount - a.totalItemCount;
    }

    return a.customerName.localeCompare(b.customerName, "zh-Hant");
  });
}

async function fetchCustomerShipmentSummaries(): Promise<
  CustomerShipmentSummary[]
> {
  const summaries: CustomerShipmentSummary[] = [];
  let nextToken: string | undefined;

  do {
    const response =
      await client.models.CustomerShipmentSummary.listCustomerShipmentSummariesByCreatedDate(
        { gsiPartition: "CustomerShipmentSummary" },
        {
          limit: 1000,
          sortDirection: "DESC",
          ...(nextToken ? { nextToken } : {}),
          selectionSet: CUSTOMER_SHIPMENT_SUMMARY_SELECTION_SET,
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

      summaries.push({
        customerId,
        customerName: String(
          summary["customerNameSnapshot"] ?? "未命名客戶",
        ),
        pendingOrderCount,
        pendingItemCount,
        shippedOrderCount,
        shippedItemCount,
        totalOrderCount: pendingOrderCount + shippedOrderCount,
        totalItemCount: pendingItemCount + shippedItemCount,
      });
    }

    nextToken = responseNextToken ?? undefined;
  } while (nextToken);

  return sortCustomerShipmentSummaries(summaries);
}

export function useCustomerShipmentSummaries(
  _statusFilter: ShipmentStatusFilter = "all",
): UseQueryResult<CustomerShipmentSummary[]> {
  return useQuery({
    queryKey: CUSTOMER_SHIPMENT_KEYS.summaries(),
    queryFn: fetchCustomerShipmentSummaries,
    staleTime: 60_000,
  });
}
