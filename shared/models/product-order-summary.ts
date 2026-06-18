import type { OrderItemStatus } from "./order";

export interface ProductOrderSummary {
  productId: string;
  productName: string;
  productImageUrl: string | null;
  price: number;
  cost: number;
  supplierName: string | null;
  totalQuantity: number;
  statusQuantities: Record<OrderItemStatus, number>;
  latestActivityAt?: string;
}

function toInteger(value: unknown): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function normalizeProductOrderSummary(
  raw: Record<string, unknown>,
): ProductOrderSummary | null {
  const productId = String(raw["productId"] ?? raw["id"] ?? "");

  if (!productId) {
    return null;
  }

  return {
    productId,
    productName: String(
      raw["productName"] ?? raw["productNameSnapshot"] ?? "未命名商品",
    ),
    productImageUrl:
      raw["productImageUrl"] != null
        ? String(raw["productImageUrl"])
        : raw["productImageUrlSnapshot"] != null
          ? String(raw["productImageUrlSnapshot"])
          : null,
    price: toInteger(raw["price"] ?? raw["priceSnapshot"]),
    cost: toInteger(raw["cost"] ?? raw["costSnapshot"]),
    supplierName:
      raw["supplierName"] != null
        ? String(raw["supplierName"])
        : raw["supplierNameSnapshot"] != null
          ? String(raw["supplierNameSnapshot"])
          : null,
    totalQuantity: toInteger(raw["totalQuantity"]),
    statusQuantities: {
      pending: toInteger(raw["pendingQuantity"]),
      ordered: toInteger(raw["orderedQuantity"]),
      received: toInteger(raw["receivedQuantity"]),
      shipped: toInteger(raw["shippedQuantity"]),
      out_of_stock: toInteger(raw["outOfStockQuantity"]),
    },
    latestActivityAt:
      raw["latestActivityAt"] != null
        ? String(raw["latestActivityAt"])
        : undefined,
  };
}
