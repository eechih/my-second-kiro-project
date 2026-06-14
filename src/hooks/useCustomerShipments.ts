import { client } from "@/lib/amplify-client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export interface PendingShipmentCustomerSummary {
  customerId: string;
  customerName: string;
  pendingOrderCount: number;
  pendingItemCount: number;
}

interface PendingShipmentCustomerRecord {
  customerId: string;
  customerName: string;
  orderId: string;
  quantity: number;
}

const CUSTOMER_SHIPMENT_KEYS = {
  all: ["customer-shipments"] as const,
  pendingSummaries: () =>
    [...CUSTOMER_SHIPMENT_KEYS.all, "pending-summaries"] as const,
};

const PENDING_SHIPMENT_SELECTION_SET = [
  "quantity",
  "orderId",
  "order.customerId",
  "order.customerNameSnapshot",
] as const;

export function buildPendingShipmentCustomerSummaries(
  records: readonly PendingShipmentCustomerRecord[],
): PendingShipmentCustomerSummary[] {
  const customerMap = new Map<
    string,
    {
      customerName: string;
      orderIds: Set<string>;
      pendingItemCount: number;
    }
  >();

  for (const record of records) {
    const existing = customerMap.get(record.customerId);

    if (existing) {
      existing.orderIds.add(record.orderId);
      existing.pendingItemCount += record.quantity;
      continue;
    }

    customerMap.set(record.customerId, {
      customerName: record.customerName,
      orderIds: new Set([record.orderId]),
      pendingItemCount: record.quantity,
    });
  }

  return [...customerMap.entries()]
    .map(([customerId, summary]) => ({
      customerId,
      customerName: summary.customerName,
      pendingOrderCount: summary.orderIds.size,
      pendingItemCount: summary.pendingItemCount,
    }))
    .sort((a, b) => {
      if (b.pendingOrderCount !== a.pendingOrderCount) {
        return b.pendingOrderCount - a.pendingOrderCount;
      }

      if (b.pendingItemCount !== a.pendingItemCount) {
        return b.pendingItemCount - a.pendingItemCount;
      }

      return a.customerName.localeCompare(b.customerName, "zh-Hant");
    });
}

async function fetchPendingShipmentCustomerSummaries(): Promise<
  PendingShipmentCustomerSummary[]
> {
  const records: PendingShipmentCustomerRecord[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.models.OrderItem.list({
      filter: {
        status: { eq: "received" },
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
      });
    }

    nextToken = responseNextToken ?? undefined;
  } while (nextToken);

  return buildPendingShipmentCustomerSummaries(records);
}

export function usePendingShipmentCustomerSummaries(): UseQueryResult<
  PendingShipmentCustomerSummary[]
> {
  return useQuery({
    queryKey: CUSTOMER_SHIPMENT_KEYS.pendingSummaries(),
    queryFn: fetchPendingShipmentCustomerSummaries,
  });
}

