export interface CustomerOrderSummary {
  customerId: string;
  customerName: string;
  readyToShipOrderCount: number;
  receivedItemCount: number;
  latestReceivedAt?: string;
  completedOrderCount: number;
  totalOrderCount: number;
}

function toInteger(value: unknown): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function normalizeCustomerOrderSummary(
  raw: Record<string, unknown>,
): CustomerOrderSummary | null {
  const customerId = String(raw["customerId"] ?? raw["id"] ?? "");

  if (!customerId) {
    return null;
  }

  return {
    customerId,
    customerName: String(
      raw["customerName"] ?? raw["customerNameSnapshot"] ?? "未命名客戶",
    ),
    readyToShipOrderCount: toInteger(raw["readyToShipOrderCount"]),
    receivedItemCount: toInteger(raw["receivedItemCount"]),
    latestReceivedAt:
      raw["latestReceivedAt"] != null
        ? String(raw["latestReceivedAt"])
        : undefined,
    completedOrderCount: toInteger(raw["completedOrderCount"]),
    totalOrderCount: toInteger(raw["totalOrderCount"]),
  };
}
