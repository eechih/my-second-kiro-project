export interface LegacyLineItemRecord {
  id: string;
  orderId: string;
  productId: string;
  productName?: string | null;
  variantLabel?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  subtotal?: number | null;
  status?: string | null;
  supplierName?: string | null;
  unitCost?: number | null;
  purchasedAt?: string | null;
  receivedAt?: string | null;
  shippedAt?: string | null;
  outOfStockAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface OrderSchemaContext {
  createdAt?: string | null;
  updatedAt?: string | null;
}

export function resolveSortTimestamp(context: OrderSchemaContext): string {
  return (
    context.createdAt ??
    context.updatedAt ??
    new Date(0).toISOString()
  );
}

export function normalizeSearchName(name: string): string {
  return name.trim().toLocaleLowerCase("zh-TW");
}

export function mapLegacyOrderToCurrentShape(
  order: Record<string, unknown>,
): Record<string, unknown> {
  const customerName =
    String(order["customerNameSnapshot"] ?? order["customerName"] ?? "");
  const totalAmount = Number(order["totalAmount"] ?? 0);
  const status = String(order["status"] ?? "pending");
  const cancelledAt =
    status === "cancelled"
      ? String(order["cancelledAt"] ?? order["updatedAt"] ?? order["createdAt"] ?? "")
      : order["cancelledAt"];

  return {
    customerNameSnapshot: customerName,
    subtotalAmount: Number(order["subtotalAmount"] ?? totalAmount),
    shippingFee: Number(order["shippingFee"] ?? 0),
    discountAmount: Number(order["discountAmount"] ?? 0),
    paymentStatus: order["paymentStatus"] ?? "UNPAID",
    fulfillmentStatus:
      order["fulfillmentStatus"] ??
      (status === "completed"
        ? "COMPLETED"
        : status === "shipping"
          ? "PARTIALLY_SHIPPED"
          : status === "confirmed"
            ? "READY_TO_SHIP"
            : status === "cancelled"
              ? "COMPLETED"
              : "PENDING"),
    cancelledAt,
    isActive: order["isActive"] ?? true,
    gsiPartition: order["gsiPartition"] ?? "Order",
    createdAtForSort:
      order["createdAtForSort"] ??
      resolveSortTimestamp({
        createdAt: typeof order["createdAt"] === "string" ? order["createdAt"] : null,
        updatedAt: typeof order["updatedAt"] === "string" ? order["updatedAt"] : null,
      }),
  };
}

export function mapLegacyLineItemToOrderItem(
  lineItem: LegacyLineItemRecord,
  productSku: string,
): Record<string, unknown> {
  return {
    id: lineItem.id,
    orderId: lineItem.orderId,
    productId: lineItem.productId,
    quantity: Number(lineItem.quantity ?? 0),
    unitPrice: Number(lineItem.unitPrice ?? 0),
    subtotalAmount: Number(lineItem.subtotal ?? 0),
    status: lineItem.status ?? "pending",
    productNameSnapshot: String(lineItem.productName ?? ""),
    productSkuSnapshot: productSku,
    variantLabelSnapshot: lineItem.variantLabel ?? null,
    supplierName: lineItem.supplierName ?? null,
    unitCost: lineItem.unitCost ?? null,
    purchasedAt: lineItem.purchasedAt ?? null,
    receivedAt: lineItem.receivedAt ?? null,
    shippedAt: lineItem.shippedAt ?? null,
    outOfStockAt: lineItem.outOfStockAt ?? null,
    createdAtForSort: resolveSortTimestamp(lineItem),
    createdAt: lineItem.createdAt ?? undefined,
    updatedAt: lineItem.updatedAt ?? undefined,
  };
}

export function mapLegacyCounterToSequenceCounter(
  counter: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: String(counter["id"] ?? counter["name"] ?? ""),
    name: String(counter["name"] ?? counter["id"] ?? ""),
    current: Number(counter["current"] ?? counter["nextNumber"] ?? 0),
    createdAt: counter["createdAt"],
    updatedAt: counter["updatedAt"],
  };
}
