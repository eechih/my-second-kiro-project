import { client } from "@/lib/amplify-client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export type ProductPurchaseStatusFilter = "all" | "pending" | "ordered";

export interface ProductPurchaseSummary {
  productId: string;
  productName: string;
  unorderedQuantity: number;
  orderedQuantity: number;
}

const PRODUCT_PURCHASE_KEYS = {
  all: ["product-purchases"] as const,
  summaries: () => [...PRODUCT_PURCHASE_KEYS.all, "summaries"] as const,
};

const PRODUCT_PURCHASE_SELECTION_SET = [
  "id",
  "productId",
  "productNameSnapshot",
  "quantity",
  "status",
  "createdAtForSort",
  "updatedAt",
] as const;

function sortProductPurchaseSummaries(
  summaries: readonly ProductPurchaseSummary[],
  statusFilter: ProductPurchaseStatusFilter,
): ProductPurchaseSummary[] {
  return [...summaries].sort((a, b) => {
    const primaryA =
      statusFilter === "ordered" ? a.orderedQuantity : a.unorderedQuantity;
    const primaryB =
      statusFilter === "ordered" ? b.orderedQuantity : b.unorderedQuantity;

    if (primaryB !== primaryA) {
      return primaryB - primaryA;
    }

    if (b.orderedQuantity !== a.orderedQuantity) {
      return b.orderedQuantity - a.orderedQuantity;
    }

    if (b.unorderedQuantity !== a.unorderedQuantity) {
      return b.unorderedQuantity - a.unorderedQuantity;
    }

    return a.productName.localeCompare(b.productName, "zh-Hant");
  });
}

async function fetchItemsByStatus(
  status: "pending" | "ordered",
): Promise<
  Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>
> {
  const items: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }> = [];
  let nextToken: string | undefined;

  do {
    const { data, errors, nextToken: responseNextToken } =
      await client.models.OrderItem.listOrderItemsByStatus(
        { status },
        {
          sortDirection: "DESC",
          limit: 100,
          ...(nextToken ? { nextToken } : {}),
          selectionSet: PRODUCT_PURCHASE_SELECTION_SET,
        } as Record<string, unknown>,
      );

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "查詢單品採購摘要失敗");
    }

    items.push(
      ...(data ?? []).map((item) => ({
        productId: String(item.productId ?? ""),
        productName: String(item.productNameSnapshot ?? "未命名商品"),
        quantity: Number(item.quantity ?? 0),
      })),
    );

    nextToken = responseNextToken ?? undefined;
  } while (nextToken);

  return items.filter((item) => item.productId);
}

async function fetchProductPurchaseSummaries(): Promise<ProductPurchaseSummary[]> {
  const [pendingItems, orderedItems] = await Promise.all([
    fetchItemsByStatus("pending"),
    fetchItemsByStatus("ordered"),
  ]);

  const summaryMap = new Map<string, ProductPurchaseSummary>();

  for (const item of pendingItems) {
    const current = summaryMap.get(item.productId) ?? {
      productId: item.productId,
      productName: item.productName,
      unorderedQuantity: 0,
      orderedQuantity: 0,
    };

    current.productName = item.productName || current.productName;
    current.unorderedQuantity += item.quantity;
    summaryMap.set(item.productId, current);
  }

  for (const item of orderedItems) {
    const current = summaryMap.get(item.productId) ?? {
      productId: item.productId,
      productName: item.productName,
      unorderedQuantity: 0,
      orderedQuantity: 0,
    };

    current.productName = item.productName || current.productName;
    current.orderedQuantity += item.quantity;
    summaryMap.set(item.productId, current);
  }

  return [...summaryMap.values()];
}

export function useProductPurchaseSummaries(
  statusFilter: ProductPurchaseStatusFilter = "all",
): UseQueryResult<ProductPurchaseSummary[]> {
  return useQuery({
    queryKey: [...PRODUCT_PURCHASE_KEYS.summaries(), statusFilter],
    queryFn: fetchProductPurchaseSummaries,
    select: (summaries) => sortProductPurchaseSummaries(summaries, statusFilter),
    staleTime: 60_000,
  });
}
