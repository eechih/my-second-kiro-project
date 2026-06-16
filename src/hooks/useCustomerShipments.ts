import { client } from "@/lib/amplify-client";
import {
  normalizeCustomerFulfillmentSummary,
  type CustomerFulfillmentSummary,
} from "@shared/models/customer-fulfillment-summary";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export type ShipmentStatusFilter =
  | "all"
  | "pending"
  | "readyToShip"
  | "shipped";

const CUSTOMER_SHIPMENT_KEYS = {
  all: ["customer-shipments"] as const,
  summaries: () => [...CUSTOMER_SHIPMENT_KEYS.all, "summaries"] as const,
};

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
  const { data, errors } = await client.queries.getCustomerShipmentSummaries(
    {},
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢客戶出貨摘要失敗");
  }

  const parsed = parseCustomerFulfillmentSummaries(data);
  if (!parsed) {
    throw new Error("查詢客戶出貨摘要失敗：回傳格式錯誤");
  }

  return parsed;
}

function parseCustomerFulfillmentSummaries(
  result: unknown,
): CustomerFulfillmentSummary[] | null {
  let payload = result;

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload) as unknown;
    } catch {
      return null;
    }
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const items = (payload as Record<string, unknown>)["items"];

  if (!Array.isArray(items)) {
    return null;
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const normalized = normalizeCustomerFulfillmentSummary(
      item as Record<string, unknown>,
    );

    return normalized ? [normalized] : [];
  });
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
