const STATUS_FIELDS = {
  PENDING: "pendingQuantity",
  ORDERED: "orderedQuantity",
  RECEIVED: "receivedQuantity",
  SHIPPED: "shippedQuantity",
  OUT_OF_STOCK: "outOfStockQuantity",
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

function buildProductMaps(products, suppliers) {
  const productSnapshots = new Map(
    products
      .map((product) => [
        String(product.id ?? ""),
        {
          productName: String(
            product.name ?? product.productNameSnapshot ?? "未命名商品",
          ),
          productSku: String(product.sku ?? "").trim() || null,
          productImageUrl: Array.isArray(product.imageUrls)
            ? String(product.imageUrls[0] ?? "").trim() || null
            : null,
          price: Number(product.price ?? 0),
          cost: Number(product.cost ?? 0),
          defaultSupplierId:
            String(product.defaultSupplierId ?? "").trim() || null,
        },
      ])
      .filter(([id]) => id),
  );
  const supplierNames = new Map(
    suppliers
      .map((supplier) => [
        String(supplier.id ?? ""),
        String(supplier.name ?? "").trim(),
      ])
      .filter(([id, name]) => id && name),
  );

  return {
    productSnapshots,
    supplierNames,
  };
}

function getSupplierSnapshot(item, productSnapshots, supplierNames) {
  const itemSupplierName = String(item.supplierName ?? "").trim();
  const productId = String(item.productId ?? "");
  const productSnapshot = productSnapshots.get(productId);
  const productSupplierId = productSnapshot?.defaultSupplierId ?? null;
  const supplierNameFromProduct =
    productSupplierId != null
      ? (supplierNames.get(productSupplierId) ?? null)
      : null;

  return {
    supplierName: itemSupplierName || supplierNameFromProduct,
  };
}

function getProductSnapshot(productId, productSnapshots) {
  const productSnapshot = productSnapshots.get(productId);

  return {
    productName: productSnapshot?.productName ?? "未命名商品",
    productSku: productSnapshot?.productSku ?? null,
    productImageUrl: productSnapshot?.productImageUrl ?? null,
    price: Number.isFinite(productSnapshot?.price) ? productSnapshot.price : 0,
    cost: Number.isFinite(productSnapshot?.cost) ? productSnapshot.cost : 0,
  };
}

function createSummary({
  productId,
  productName,
  productSku,
  productImageUrl,
  price,
  cost,
  now,
}) {
  return {
    id: productId,
    productId,
    productNameSnapshot: productName,
    productSkuSnapshot: productSku,
    productImageUrlSnapshot: productImageUrl,
    priceSnapshot: price,
    costSnapshot: cost,
    supplierNameSnapshot: null,
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

export function buildProductOrderSummariesFromOrders({
  products = [],
  suppliers = [],
  orders,
  now = new Date().toISOString(),
}) {
  const { productSnapshots, supplierNames } = buildProductMaps(
    products,
    suppliers,
  );
  const summaries = new Map(
    products.map((product) => {
      const productId = String(product.id ?? "");
      const productSnapshot = getProductSnapshot(productId, productSnapshots);

      return [
        productId,
        createSummary({
          productId,
          productName: productSnapshot.productName,
          productSku: productSnapshot.productSku,
          productImageUrl: productSnapshot.productImageUrl,
          price: productSnapshot.price,
          cost: productSnapshot.cost,
          now,
        }),
      ];
    }),
  );

  for (const item of orders) {
    const productId = String(item.productId ?? "");
    const status = String(item.status ?? "");
    const field = STATUS_FIELDS[status];

    if (!productId || !field) {
      continue;
    }

    const quantity = toQuantity(item.quantity);
    const latestActivityAt = getLatestActivityAt(item);
    const productSnapshot = getProductSnapshot(productId, productSnapshots);
    const productName =
      String(item.productNameSnapshot ?? "").trim() ||
      productSnapshot.productName;
    const supplierSnapshot = getSupplierSnapshot(
      item,
      productSnapshots,
      supplierNames,
    );
    const current =
      summaries.get(productId) ??
      createSummary({
        productId,
        productName,
        productSku: productSnapshot.productSku,
        productImageUrl: productSnapshot.productImageUrl,
        price: productSnapshot.price,
        cost: productSnapshot.cost,
        now,
      });

    if (
      productName &&
      (!current.latestActivityAt ||
        (latestActivityAt && latestActivityAt >= current.latestActivityAt))
    ) {
      current.productNameSnapshot = productName;
      current.productSkuSnapshot = productSnapshot.productSku;
    }
    current.productImageUrlSnapshot = productSnapshot.productImageUrl;
    current.priceSnapshot = productSnapshot.price;
    current.costSnapshot = productSnapshot.cost;
    if (supplierSnapshot.supplierName && !current.supplierNameSnapshot) {
      current.supplierNameSnapshot = supplierSnapshot.supplierName;
    }
    if (
      latestActivityAt &&
      (!current.latestActivityAt ||
        latestActivityAt >= current.latestActivityAt)
    ) {
      if (supplierSnapshot.supplierName) {
        current.supplierNameSnapshot = supplierSnapshot.supplierName;
      }
    }
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
