export interface ProductOrderSummary {
  productId: string;
  productName: string;
  productSku: string | null;
  productImageUrl: string | null;
  price: number;
  cost: number;
  supplierName: string | null;
  totalQuantity: number;
  statusQuantities: Record<string, number>;
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
    productSku:
      raw["productSku"] != null
        ? String(raw["productSku"])
        : raw["productSkuSnapshot"] != null
          ? String(raw["productSkuSnapshot"])
          : null,
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
      PENDING: toInteger(raw["pendingQuantity"]),
      ORDERED: toInteger(raw["orderedQuantity"]),
      RECEIVED: toInteger(raw["receivedQuantity"]),
      SHIPPED: toInteger(raw["shippedQuantity"]),
      OUT_OF_STOCK: toInteger(raw["outOfStockQuantity"]),
      COMPLETED: toInteger(raw["completedQuantity"]),
      CANCELLED: toInteger(raw["cancelledQuantity"]),
    },
    latestActivityAt:
      raw["latestActivityAt"] != null
        ? String(raw["latestActivityAt"])
        : undefined,
  };
}
