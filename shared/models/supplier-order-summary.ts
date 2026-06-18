export interface SupplierOrderSummary {
  supplierName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  totalQuantity: number;
  latestActivityAt?: string;
}

function toInteger(value: unknown): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function normalizeSupplierOrderSummary(
  raw: Record<string, unknown>,
): SupplierOrderSummary | null {
  const supplierName = String(
    raw["supplierName"] ?? raw["supplierNameSnapshot"] ?? raw["id"] ?? "",
  ).trim();

  if (!supplierName) {
    return null;
  }

  return {
    supplierName,
    orderedQuantity: toInteger(raw["orderedQuantity"]),
    receivedQuantity: toInteger(raw["receivedQuantity"]),
    totalQuantity: toInteger(raw["totalQuantity"]),
    latestActivityAt:
      raw["latestActivityAt"] != null
        ? String(raw["latestActivityAt"])
        : undefined,
  };
}
