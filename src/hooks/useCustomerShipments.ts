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

interface CustomerShipmentRecord {
  customerId: string;
  customerName: string;
  orderId: string;
  quantity: number;
  status: "received" | "shipped";
}

const CUSTOMER_SHIPMENT_KEYS = {
  all: ["customer-shipments"] as const,
  summaries: () => [...CUSTOMER_SHIPMENT_KEYS.all, "summaries"] as const,
};

const PENDING_SHIPMENT_SELECTION_SET = [
  "quantity",
  "orderId",
  "order.customerId",
  "order.customerNameSnapshot",
] as const;

export function buildCustomerShipmentSummaries(
  records: readonly CustomerShipmentRecord[],
): CustomerShipmentSummary[] {
  const customerMap = new Map<
    string,
    {
      customerName: string;
      pendingOrderIds: Set<string>;
      shippedOrderIds: Set<string>;
      pendingItemCount: number;
      shippedItemCount: number;
    }
  >();

  for (const record of records) {
    const existing = customerMap.get(record.customerId);

    if (existing) {
      if (record.status === "received") {
        existing.pendingOrderIds.add(record.orderId);
        existing.pendingItemCount += record.quantity;
      } else {
        existing.shippedOrderIds.add(record.orderId);
        existing.shippedItemCount += record.quantity;
      }
      continue;
    }

    customerMap.set(record.customerId, {
      customerName: record.customerName,
      pendingOrderIds:
        record.status === "received" ? new Set([record.orderId]) : new Set(),
      shippedOrderIds:
        record.status === "shipped" ? new Set([record.orderId]) : new Set(),
      pendingItemCount: record.status === "received" ? record.quantity : 0,
      shippedItemCount: record.status === "shipped" ? record.quantity : 0,
    });
  }

  return [...customerMap.entries()]
    .map(([customerId, summary]) => ({
      customerId,
      customerName: summary.customerName,
      pendingOrderCount: summary.pendingOrderIds.size,
      pendingItemCount: summary.pendingItemCount,
      shippedOrderCount: summary.shippedOrderIds.size,
      shippedItemCount: summary.shippedItemCount,
      totalOrderCount:
        new Set([...summary.pendingOrderIds, ...summary.shippedOrderIds]).size,
      totalItemCount: summary.pendingItemCount + summary.shippedItemCount,
    }))
    .sort((a, b) => {
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
  const records: CustomerShipmentRecord[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.models.OrderItem.list({
      filter: {
        or: [{ status: { eq: "received" } }, { status: { eq: "shipped" } }],
      },
      limit: 1000,
      ...(nextToken ? { nextToken } : {}),
      selectionSet: PENDING_SHIPMENT_SELECTION_SET,
    });

    const { data, errors, nextToken: responseNextToken } = response;

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "查詢客戶待出貨資料失敗");
    }

    for (const rawItem of data ?? []) {
      const item = rawItem as unknown as Record<string, unknown>;
      const orderRaw =
        item.order && typeof item.order === "object"
          ? (item.order as Record<string, unknown>)
          : undefined;
      const customerId = String(orderRaw?.customerId ?? "");

      if (!customerId) {
        continue;
      }

      records.push({
        customerId,
        customerName: String(orderRaw?.customerNameSnapshot ?? "未命名客戶"),
        orderId: String(item.orderId ?? ""),
        quantity: Number(item.quantity ?? 0),
        status: item.status === "shipped" ? "shipped" : "received",
      });
    }

    nextToken = responseNextToken ?? undefined;
  } while (nextToken);

  return buildCustomerShipmentSummaries(records);
}

export function useCustomerShipmentSummaries(): UseQueryResult<
  CustomerShipmentSummary[]
> {
  return useQuery({
    queryKey: CUSTOMER_SHIPMENT_KEYS.summaries(),
    queryFn: fetchCustomerShipmentSummaries,
  });
}
