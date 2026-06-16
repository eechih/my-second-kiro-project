function getLatestReceivedAt(items) {
  return items
    .filter((item) => item.receivedAt)
    .reduce(
      (latest, item) =>
        latest && latest > item.receivedAt ? latest : item.receivedAt,
      null,
    );
}

export function buildCustomerFulfillmentSummariesFromOrders(orders) {
  const summaryByCustomerId = new Map();

  for (const order of orders) {
    const customerId = order.customerId;
    if (!customerId) {
      continue;
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const customerNameSnapshot = order.customerNameSnapshot ?? "未命名客戶";
    const totalItemCount = items.reduce(
      (sum, item) => sum + Number(item.quantity ?? 0),
      0,
    );
    const latestReadyToShipReceivedAt = getLatestReceivedAt(items);
    const isPending = order.fulfillmentStatus === "UNFULFILLED";
    const isReadyToShip = order.fulfillmentStatus === "READY_TO_SHIP";
    const isShipped =
      order.fulfillmentStatus === "SHIPPED" ||
      order.fulfillmentStatus === "COMPLETED";
    const pendingItemCount = isPending ? totalItemCount : 0;
    const readyToShipItemCount = isReadyToShip ? totalItemCount : 0;
    const shippedItemCount = isShipped ? totalItemCount : 0;

    if (
      !isPending &&
      !isReadyToShip &&
      !isShipped &&
      pendingItemCount === 0 &&
      readyToShipItemCount === 0 &&
      shippedItemCount === 0
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
      completedOrderCount:
        existing.completedOrderCount + (order.status === "COMPLETED" ? 1 : 0),
      totalOrderCount: existing.totalOrderCount + 1,
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

  return [...summaryByCustomerId.values()];
}
