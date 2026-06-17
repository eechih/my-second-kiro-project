import {
  useProductOrderSummaries,
  type ProductOrderSummary,
} from "@/hooks/useOrders";
import type { UseQueryResult } from "@tanstack/react-query";
import type { OrderItemStatus } from "@shared/models";

export type ProductPurchaseStatusFilter = "all" | OrderItemStatus;
export type ProductPurchaseSummary = ProductOrderSummary;

function sortProductPurchaseSummaries(
  summaries: readonly ProductPurchaseSummary[],
  statusFilter: ProductPurchaseStatusFilter,
): ProductPurchaseSummary[] {
  return [...summaries].sort((a, b) => {
    const primaryA =
      statusFilter === "all"
        ? a.totalQuantity
        : a.statusQuantities[statusFilter];
    const primaryB =
      statusFilter === "all"
        ? b.totalQuantity
        : b.statusQuantities[statusFilter];

    if (primaryB !== primaryA) {
      return primaryB - primaryA;
    }

    if (b.totalQuantity !== a.totalQuantity) {
      return b.totalQuantity - a.totalQuantity;
    }

    return a.productName.localeCompare(b.productName, "zh-Hant");
  });
}

export function useProductPurchaseSummaries(
  statusFilter: ProductPurchaseStatusFilter = "all",
): UseQueryResult<ProductPurchaseSummary[]> {
  const result = useProductOrderSummaries();

  return {
    ...result,
    data: result.data
      ? sortProductPurchaseSummaries(result.data, statusFilter)
      : result.data,
  } as UseQueryResult<ProductPurchaseSummary[]>;
}
