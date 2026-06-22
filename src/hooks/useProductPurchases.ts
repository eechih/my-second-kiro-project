import { client } from "@/lib/amplify-client";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  normalizeProductOrderSummary,
  type ProductOrderSummary,
} from "@shared/models/product-order-summary";

export type ProductPurchaseStatusFilter = "pending" | "ordered";
export type ProductPurchaseSummary = ProductOrderSummary;

const PRODUCT_PURCHASE_KEYS = {
  all: ["product-purchases"] as const,
  summaries: () => [...PRODUCT_PURCHASE_KEYS.all, "summaries"] as const,
};

const PRODUCT_ORDER_SUMMARY_SELECTION_SET = [
  "id",
  "productId",
  "productNameSnapshot",
  "productImageUrlSnapshot",
  "priceSnapshot",
  "costSnapshot",
  "supplierNameSnapshot",
  "pendingQuantity",
  "orderedQuantity",
  "receivedQuantity",
  "shippedQuantity",
  "outOfStockQuantity",
  "completedQuantity",
  "cancelledQuantity",
  "totalQuantity",
  "latestActivityAt",
] as const;

function sortProductPurchaseSummaries(
  summaries: readonly ProductPurchaseSummary[],
  _statusFilter: ProductPurchaseStatusFilter,
): ProductPurchaseSummary[] {
  return [...summaries].sort((a, b) => {
    const primaryA = a.statusQuantities["PENDING"] ?? 0;
    const primaryB = b.statusQuantities["PENDING"] ?? 0;

    if (primaryB !== primaryA) {
      return primaryB - primaryA;
    }

    if (b.totalQuantity !== a.totalQuantity) {
      return b.totalQuantity - a.totalQuantity;
    }

    return a.productName.localeCompare(b.productName, "zh-Hant");
  });
}

async function fetchProductPurchaseSummaries(): Promise<
  ProductPurchaseSummary[]
> {
  const { data, errors } =
    await client.models.ProductOrderSummary.listProductOrderSummariesByPendingQuantity(
      { gsiPartition: "ProductOrderSummary" },
      {
        sortDirection: "DESC",
        selectionSet: PRODUCT_ORDER_SUMMARY_SELECTION_SET,
      } as Record<string, unknown>,
    );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢單品採購摘要失敗");
  }

  return (data ?? []).flatMap((item) => {
    const normalized = normalizeProductOrderSummary(
      item as unknown as Record<string, unknown>,
    );

    return normalized ? [normalized] : [];
  });
}

export function useProductPurchaseSummaries(
  statusFilter: ProductPurchaseStatusFilter = "pending",
): UseQueryResult<ProductPurchaseSummary[]> {
  return useQuery({
    queryKey: [...PRODUCT_PURCHASE_KEYS.summaries(), statusFilter],
    queryFn: fetchProductPurchaseSummaries,
    select: (summaries) =>
      sortProductPurchaseSummaries(summaries, statusFilter),
    staleTime: 60_000,
  });
}
