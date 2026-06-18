function toQuantity(value) {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function getLatestActivityAt(item) {
  return (
    item.updatedAt ??
    item.receivedAt ??
    item.purchasedAt ??
    item.createdAtForSort ??
    item.createdAt ??
    undefined
  );
}

function createSummary({ supplierName, now }) {
  return {
    id: supplierName,
    supplierNameSnapshot: supplierName,
    orderedQuantity: 0,
    receivedQuantity: 0,
    totalQuantity: 0,
    latestActivityAt: undefined,
    gsiPartition: "SupplierOrderSummary",
    createdAt: now,
    createdAtForSort: now,
    updatedAt: now,
  };
}

export function buildSupplierOrderSummariesFromOrderItems({
  orderItems,
  now = new Date().toISOString(),
}) {
  const summaries = new Map();

  for (const item of orderItems) {
    const supplierName = String(item.supplierName ?? "").trim();
    const status = String(item.status ?? "");

    if (!supplierName || (status !== "ordered" && status !== "received")) {
      continue;
    }

    const quantity = toQuantity(item.quantity);
    const latestActivityAt = getLatestActivityAt(item);
    const current =
      summaries.get(supplierName) ??
      createSummary({
        supplierName,
        now,
      });

    current.supplierNameSnapshot = supplierName;

    if (status === "ordered") {
      current.orderedQuantity += quantity;
    }

    if (status === "received") {
      current.receivedQuantity += quantity;
    }

    current.totalQuantity += quantity;
    current.latestActivityAt =
      latestActivityAt &&
      (!current.latestActivityAt || latestActivityAt > current.latestActivityAt)
        ? latestActivityAt
        : current.latestActivityAt;

    summaries.set(supplierName, current);
  }

  return [...summaries.values()].map((summary) => ({
    ...summary,
    createdAtForSort: summary.latestActivityAt ?? summary.createdAtForSort,
    latestActivityAt: summary.latestActivityAt ?? null,
  }));
}
