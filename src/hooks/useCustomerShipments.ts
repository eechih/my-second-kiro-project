import { client } from "@/lib/amplify-client";
import {
  normalizeCustomerOrderSummary,
  type CustomerOrderSummary,
} from "@shared/models/customer-order-summary";
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
  summaries: readonly CustomerOrderSummary[],
  statusFilter: ShipmentStatusFilter = "all",
): CustomerOrderSummary[] {
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
  CustomerOrderSummary[]
> {
  const { data, errors } = await client.queries.getCustomerOrderSummaries({});

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢客戶出貨摘要失敗");
  }

  const parsed = parseCustomerOrderSummaries(data);
  if (!parsed) {
    throw new Error("查詢客戶出貨摘要失敗：回傳格式錯誤");
  }

  return parsed;
}

function parseCustomerOrderSummaries(
  result: unknown,
): CustomerOrderSummary[] | null {
  const payload = parseJsonPayload(result);
  if (payload == null) {
    return [];
  }

  const items = extractCustomerOrderSummaryItems(payload);
  if (!items) {
    return null;
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const normalized = normalizeCustomerOrderSummary(
      item as Record<string, unknown>,
    );

    return normalized ? [normalized] : [];
  });
}

function parseJsonPayload(result: unknown): unknown {
  let current = result;

  for (let i = 0; i < 3; i += 1) {
    if (typeof current === "string") {
      try {
        current = JSON.parse(current) as unknown;
      } catch {
        return null;
      }
      continue;
    }

    return current;
  }

  return current;
}

function extractCustomerOrderSummaryItems(
  payload: unknown,
): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record["items"])) {
    return record["items"];
  }

  if (Array.isArray(record["data"])) {
    return record["data"];
  }

  if (
    typeof record["customerId"] === "string" ||
    typeof record["id"] === "string"
  ) {
    return [record];
  }

  return null;
}

export function useCustomerShipmentSummaries(
  statusFilter: ShipmentStatusFilter = "all",
): UseQueryResult<CustomerOrderSummary[]> {
  return useQuery({
    queryKey: [...CUSTOMER_SHIPMENT_KEYS.summaries(), statusFilter],
    queryFn: fetchCustomerShipmentSummaries,
    select: (summaries) =>
      sortCustomerShipmentSummaries(summaries, statusFilter),
    staleTime: 60_000,
  });
}
