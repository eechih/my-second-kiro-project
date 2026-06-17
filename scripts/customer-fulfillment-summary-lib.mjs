function getLatestReceivedAt(items) {
  return items
    .filter((item) => item.status === "received" && item.receivedAt)
    .reduce(
      (latest, item) =>
        latest && latest > item.receivedAt ? latest : item.receivedAt,
      null,
    );
}

function getLatestShippedAt(items) {
  return items
    .filter((item) => item.status === "shipped" && item.shippedAt)
    .reduce(
      (latest, item) =>
        latest && latest > item.shippedAt ? latest : item.shippedAt,
      null,
    );
}

function isShipmentRelevantOrder(order) {
  return (
    order.status !== "CANCELLED" &&
    order.paymentStatus !== "REFUNDED" &&
    order.paymentStatus !== "PARTIALLY_REFUNDED"
  );
}

function getShipmentSummaryBucket(order) {
  if (!isShipmentRelevantOrder(order)) {
    return null;
  }

  switch (order.status) {
    case "PENDING":
    case "ORDERED":
    case "OUT_OF_STOCK":
      return "pending";
    case "RECEIVED":
      return "readyToShip";
    case "SHIPPED":
    case "COMPLETED":
      return "shipped";
    default:
      return null;
  }
}

export function buildCustomerFulfillmentSummariesFromOrders(input) {
  const orders = Array.isArray(input) ? input : input.orders;
  const customers = Array.isArray(input) ? undefined : input.customers;
  const summaryByCustomerId = new Map();
  const allowedCustomerIds = customers
    ? new Set(customers.map((customer) => String(customer.id ?? "")))
    : null;

  for (const order of orders) {
    const customerId = order.customerId;
    if (!customerId) {
      continue;
    }

    if (allowedCustomerIds && !allowedCustomerIds.has(String(customerId))) {
      continue;
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const customerNameSnapshot = order.customerNameSnapshot ?? "未命名客戶";
    const totalItemCount = items.reduce(
      (sum, item) => sum + Number(item.quantity ?? 0),
      0,
    );
    const bucket = getShipmentSummaryBucket(order);
    const latestReadyToShipReceivedAt =
      bucket === "readyToShip" ? getLatestReceivedAt(items) : null;
    const latestShippedAt = bucket === "shipped" ? getLatestShippedAt(items) : null;
    const isPending = bucket === "pending";
    const isReadyToShip = bucket === "readyToShip";
    const isShipped = bucket === "shipped";
    const pendingItemCount = isPending ? totalItemCount : 0;
    const readyToShipItemCount = isReadyToShip ? totalItemCount : 0;
    const shippedItemCount = isShipped ? totalItemCount : 0;
    const totalOrderCount = isShipmentRelevantOrder(order) ? 1 : 0;
    const completedOrderCount = order.status === "COMPLETED" ? 1 : 0;

    if (
      !isPending &&
      !isReadyToShip &&
      !isShipped &&
      totalOrderCount === 0 &&
      completedOrderCount === 0
    ) {
      continue;
    }

    const existing = summaryByCustomerId.get(customerId) ?? {
      id: customerId,
      customerId,
      customerNameSnapshot,
      pendingOrderCount: 0,
      pendingItemCount: 0,
      readyToShipOrderCount: 0,
      readyToShipItemCount: 0,
      latestReadyToShipReceivedAt: null,
      shippedOrderCount: 0,
      shippedItemCount: 0,
      latestShippedAt: null,
      completedOrderCount: 0,
      totalOrderCount: 0,
      gsiPartition: "CustomerFulfillmentSummary",
      createdAtForSort: order.createdAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    summaryByCustomerId.set(customerId, {
      ...existing,
      customerNameSnapshot,
      pendingOrderCount: existing.pendingOrderCount + (isPending ? 1 : 0),
      pendingItemCount: existing.pendingItemCount + pendingItemCount,
      readyToShipOrderCount:
        existing.readyToShipOrderCount + (isReadyToShip ? 1 : 0),
      readyToShipItemCount:
        existing.readyToShipItemCount + readyToShipItemCount,
      latestReadyToShipReceivedAt:
        existing.latestReadyToShipReceivedAt &&
        latestReadyToShipReceivedAt
          ? existing.latestReadyToShipReceivedAt > latestReadyToShipReceivedAt
            ? existing.latestReadyToShipReceivedAt
            : latestReadyToShipReceivedAt
          : (existing.latestReadyToShipReceivedAt ?? latestReadyToShipReceivedAt),
      shippedOrderCount: existing.shippedOrderCount + (isShipped ? 1 : 0),
      shippedItemCount: existing.shippedItemCount + shippedItemCount,
      latestShippedAt:
        existing.latestShippedAt && latestShippedAt
          ? existing.latestShippedAt > latestShippedAt
            ? existing.latestShippedAt
            : latestShippedAt
          : (existing.latestShippedAt ?? latestShippedAt),
      completedOrderCount:
        existing.completedOrderCount + completedOrderCount,
      totalOrderCount: existing.totalOrderCount + totalOrderCount,
      createdAtForSort:
        existing.createdAtForSort < order.createdAt
          ? existing.createdAtForSort
          : order.createdAt,
      createdAt:
        existing.createdAt < order.createdAt ? existing.createdAt : order.createdAt,
      updatedAt:
        existing.updatedAt > order.updatedAt ? existing.updatedAt : order.updatedAt,
    });
  }

  if (!customers) {
    return [...summaryByCustomerId.values()];
  }

  return customers
    .map((customer) => summaryByCustomerId.get(String(customer.id ?? "")))
    .filter(Boolean);
}
