const STATUS_FIELDS = {
  pending: "pendingQuantity",
  ordered: "orderedQuantity",
  received: "receivedQuantity",
  shipped: "shippedQuantity",
  out_of_stock: "outOfStockQuantity",
};

function toQuantity(value) {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function getLatestActivityAt(item) {
  return (
    item.updatedAt ??
    item.outOfStockAt ??
    item.shippedAt ??
    item.receivedAt ??
    item.purchasedAt ??
    item.createdAtForSort ??
    item.createdAt ??
    undefined
  );
}

function createSummary({ productId, productName, now }) {
  return {
    id: productId,
    productId,
    productNameSnapshot: productName,
    pendingQuantity: 0,
    orderedQuantity: 0,
    receivedQuantity: 0,
    shippedQuantity: 0,
    outOfStockQuantity: 0,
    totalQuantity: 0,
    latestActivityAt: undefined,
    gsiPartition: "ProductOrderSummary",
    createdAt: now,
    createdAtForSort: now,
    updatedAt: now,
  };
}

export function buildProductOrderSummariesFromOrderItems({
  products,
  orderItems,
  now = new Date().toISOString(),
}) {
  const productNames = new Map(
    products
      .map((product) => [
        String(product.id ?? ""),
        String(product.name ?? product.productNameSnapshot ?? "未命名商品"),
      ])
      .filter(([id]) => id),
  );
  const summaries = new Map();

  for (const item of orderItems) {
    const productId = String(item.productId ?? "");
    const status = String(item.status ?? "");
    const field = STATUS_FIELDS[status];

    if (!productId || !field) {
      continue;
    }

    const quantity = toQuantity(item.quantity);
    const productName = String(
      item.productNameSnapshot ?? productNames.get(productId) ?? "未命名商品",
    );
    const current =
      summaries.get(productId) ??
      createSummary({
        productId,
        productName,
        now,
      });
    const latestActivityAt = getLatestActivityAt(item);

    current.productNameSnapshot = productName || current.productNameSnapshot;
    current[field] += quantity;
    current.totalQuantity += quantity;
    current.latestActivityAt =
      latestActivityAt &&
      (!current.latestActivityAt || latestActivityAt > current.latestActivityAt)
        ? latestActivityAt
        : current.latestActivityAt;
    summaries.set(productId, current);
  }

  return [...summaries.values()].map((summary) => ({
    ...summary,
    createdAtForSort: summary.latestActivityAt ?? summary.createdAtForSort,
    latestActivityAt: summary.latestActivityAt ?? null,
  }));
}
