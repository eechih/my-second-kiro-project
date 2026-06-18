import { client } from "@/lib/amplify-client";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  normalizeSupplierOrderSummary,
  type SupplierOrderSummary,
} from "@shared/models/supplier-order-summary";

export type SupplierReceivingStatusFilter = "all" | "ordered";
export type SupplierReceivingSummary = SupplierOrderSummary;

export const SUPPLIER_RECEIVING_KEYS = {
  all: ["supplier-receivings"] as const,
  summaries: () => [...SUPPLIER_RECEIVING_KEYS.all, "summaries"] as const,
};

const SUPPLIER_ORDER_SUMMARY_SELECTION_SET = [
  "id",
  "supplierNameSnapshot",
  "orderedQuantity",
  "receivedQuantity",
  "totalQuantity",
  "latestActivityAt",
] as const;

function sortSupplierReceivingSummaries(
  summaries: readonly SupplierReceivingSummary[],
): SupplierReceivingSummary[] {
  return [...summaries].sort((a, b) => {
    if (b.orderedQuantity !== a.orderedQuantity) {
      return b.orderedQuantity - a.orderedQuantity;
    }

    if (b.receivedQuantity !== a.receivedQuantity) {
      return b.receivedQuantity - a.receivedQuantity;
    }

    return a.supplierName.localeCompare(b.supplierName, "zh-Hant");
  });
}

async function fetchSupplierReceivingSummaries(): Promise<
  SupplierReceivingSummary[]
> {
  const { data, errors } =
    await client.models.SupplierOrderSummary.listSupplierOrderSummariesByOrderedQuantity(
      { gsiPartition: "SupplierOrderSummary" },
      {
        sortDirection: "DESC",
        selectionSet: SUPPLIER_ORDER_SUMMARY_SELECTION_SET,
      } as Record<string, unknown>,
    );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢供應商入庫摘要失敗");
  }

  return (data ?? []).flatMap((item) => {
    const normalized = normalizeSupplierOrderSummary(
      item as unknown as Record<string, unknown>,
    );

    return normalized ? [normalized] : [];
  });
}

export function useSupplierReceivingSummaries(
  statusFilter: SupplierReceivingStatusFilter = "ordered",
): UseQueryResult<SupplierReceivingSummary[]> {
  return useQuery({
    queryKey: [...SUPPLIER_RECEIVING_KEYS.summaries(), statusFilter],
    queryFn: fetchSupplierReceivingSummaries,
    select: sortSupplierReceivingSummaries,
    staleTime: 60_000,
  });
}
