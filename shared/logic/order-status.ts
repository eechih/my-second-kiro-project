/**
 * 訂單狀態轉換驗證與自動推導
 */

import type { OrderItem, OrderStatus } from "../models/order";

const ALLOWED_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  PENDING: new Set<OrderStatus>(["CANCELLED"]),
  ORDERED: new Set<OrderStatus>(["CANCELLED"]),
  RECEIVED: new Set<OrderStatus>(["CANCELLED"]),
  SHIPPED: new Set<OrderStatus>(["COMPLETED"]),
  COMPLETED: new Set<OrderStatus>([]),
  OUT_OF_STOCK: new Set<OrderStatus>(["CANCELLED"]),
  CANCELLED: new Set<OrderStatus>([]),
};

export function isValidOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.has(to);
}

export function getNextAllowedOrderStatuses(
  current: OrderStatus,
): OrderStatus[] {
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed) {
    return [];
  }
  return [...allowed];
}

export function deriveOrderStatusFromOrderItems(
  orderItems: ReadonlyArray<Pick<OrderItem, "status">>,
): OrderStatus {
  if (orderItems.length === 0) {
    return "PENDING";
  }

  if (orderItems.every((item) => item.status === "shipped")) {
    return "COMPLETED";
  }

  if (orderItems.some((item) => item.status === "shipped")) {
    return "SHIPPED";
  }

  if (orderItems.some((item) => item.status === "received")) {
    return "RECEIVED";
  }

  if (orderItems.some((item) => item.status === "ordered")) {
    return "ORDERED";
  }

  if (orderItems.every((item) => item.status === "out_of_stock")) {
    return "OUT_OF_STOCK";
  }

  if (orderItems.some((item) => item.status === "out_of_stock")) {
    return "OUT_OF_STOCK";
  }

  return "PENDING";
}
