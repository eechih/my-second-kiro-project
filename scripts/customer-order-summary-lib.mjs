function isShipmentRelevantOrder(order) {
  return (
    order.status !== "CANCELLED" &&
    order.paymentStatus !== "REFUNDED" &&
    order.paymentStatus !== "PARTIALLY_REFUNDED"
  );
}

function isReadyToShipOrder(order) {
  return order.status === "RECEIVED" && isShipmentRelevantOrder(order);
}

export function buildCustomerOrderSummariesFromOrders(input) {
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

    const customerNameSnapshot = order.customerNameSnapshot ?? "未命名客戶";
    const receivedItemCount = order.status === "RECEIVED" ? Number(order.quantity ?? 0) : 0;
    const latestReceivedAt = order.status === "RECEIVED" ? (order.receivedAt ?? null) : null;
    const totalOrderCount = isShipmentRelevantOrder(order) ? 1 : 0;
    const completedOrderCount = order.status === "COMPLETED" ? 1 : 0;
    const readyToShipOrderCount = isReadyToShipOrder(order) ? 1 : 0;

    if (
      readyToShipOrderCount === 0 &&
      receivedItemCount === 0 &&
      totalOrderCount === 0 &&
      completedOrderCount === 0
    ) {
      continue;
    }

    const existing = summaryByCustomerId.get(customerId) ?? {
      id: customerId,
      customerId,
      customerNameSnapshot,
      readyToShipOrderCount: 0,
      receivedItemCount: 0,
      latestReceivedAt: null,
      completedOrderCount: 0,
      totalOrderCount: 0,
      gsiPartition: "CustomerOrderSummary",
      createdAtForSort: order.createdAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    summaryByCustomerId.set(customerId, {
      ...existing,
      customerNameSnapshot,
      readyToShipOrderCount:
        existing.readyToShipOrderCount + readyToShipOrderCount,
      receivedItemCount: existing.receivedItemCount + receivedItemCount,
      latestReceivedAt:
        existing.latestReceivedAt && latestReceivedAt
          ? existing.latestReceivedAt > latestReceivedAt
            ? existing.latestReceivedAt
            : latestReceivedAt
          : (existing.latestReceivedAt ?? latestReceivedAt),
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
