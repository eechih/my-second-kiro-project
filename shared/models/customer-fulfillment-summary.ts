export interface CustomerFulfillmentSummary {
  customerId: string;
  customerName: string;
  pendingOrderCount: number;
  pendingItemCount: number;
  readyToShipOrderCount: number;
  readyToShipItemCount: number;
  shippedOrderCount: number;
  shippedItemCount: number;
  latestShippedAt?: string;
  completedOrderCount: number;
  totalOrderCount: number;
  latestReadyToShipReceivedAt?: string;
}

function toInteger(value: unknown): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function normalizeCustomerFulfillmentSummary(
  raw: Record<string, unknown>,
): CustomerFulfillmentSummary | null {
  const customerId = String(raw["customerId"] ?? raw["id"] ?? "");

  if (!customerId) {
    return null;
  }

  return {
    customerId,
    customerName: String(
      raw["customerName"] ?? raw["customerNameSnapshot"] ?? "未命名客戶",
    ),
    pendingOrderCount: toInteger(raw["pendingOrderCount"]),
    pendingItemCount: toInteger(raw["pendingItemCount"]),
    readyToShipOrderCount: toInteger(raw["readyToShipOrderCount"]),
    readyToShipItemCount: toInteger(raw["readyToShipItemCount"]),
    latestReadyToShipReceivedAt:
      raw["latestReadyToShipReceivedAt"] != null
        ? String(raw["latestReadyToShipReceivedAt"])
        : undefined,
    shippedOrderCount: toInteger(raw["shippedOrderCount"]),
    shippedItemCount: toInteger(raw["shippedItemCount"]),
    latestShippedAt:
      raw["latestShippedAt"] != null
        ? String(raw["latestShippedAt"])
        : undefined,
    completedOrderCount: toInteger(raw["completedOrderCount"]),
    totalOrderCount: toInteger(raw["totalOrderCount"]),
  };
}
