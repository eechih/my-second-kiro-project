import type {
  GetItemCommandOutput,
  TransactWriteItem,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { OrderStatus } from "@shared/models/order";

type ShipmentStatus = "ordered" | "received" | "shipped";

type ShipmentSummaryBucket = "pending" | "readyToShip" | "shipped";

type ShipmentSummaryDelta = {
  pendingOrderCountDelta: number;
  pendingItemCountDelta: number;
  readyToShipOrderCountDelta: number;
  readyToShipItemCountDelta: number;
  shippedOrderCountDelta: number;
  shippedItemCountDelta: number;
  completedOrderCountDelta: number;
  totalOrderCountDelta: number;
};

type ShipmentSummaryRecord = {
  customerId: string;
  customerNameSnapshot: string;
  pendingOrderCount: number;
  pendingItemCount: number;
  readyToShipOrderCount: number;
  readyToShipItemCount: number;
  latestReadyToShipReceivedAt?: string;
  shippedOrderCount: number;
  shippedItemCount: number;
  latestShippedAt?: string;
  completedOrderCount: number;
  totalOrderCount: number;
  createdAt?: string;
};

type OrderItemLike = {
  id: string;
  status: ShipmentStatus;
  quantity: number;
  receivedAt?: string;
  shippedAt?: string;
};

function isShipmentRelevantOrder(status: OrderStatus): boolean {
  return status !== "CANCELLED";
}

function getShipmentSummaryBucket(
  orderStatus: OrderStatus,
): ShipmentSummaryBucket | null {
  if (!isShipmentRelevantOrder(orderStatus)) {
    return null;
  }

  switch (orderStatus) {
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

function getTotalItemQuantity(items: readonly OrderItemLike[]): number {
  return items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
}

function getLatestReadyToShipReceivedAt(
  items: readonly OrderItemLike[],
): string | undefined {
  return items.reduce<string | undefined>((latest, item) => {
    if (item.status !== "received" || !item.receivedAt) {
      return latest;
    }

    if (!latest || item.receivedAt > latest) {
      return item.receivedAt;
    }

    return latest;
  }, undefined);
}

function applyBucketDelta(
  delta: ShipmentSummaryDelta,
  bucket: ShipmentSummaryBucket | null,
  quantity: number,
  multiplier: 1 | -1,
): ShipmentSummaryDelta {
  if (bucket === "pending") {
    delta.pendingOrderCountDelta += multiplier;
    delta.pendingItemCountDelta += quantity * multiplier;
    return delta;
  }

  if (bucket === "readyToShip") {
    delta.readyToShipOrderCountDelta += multiplier;
    delta.readyToShipItemCountDelta += quantity * multiplier;
    return delta;
  }

  if (bucket === "shipped") {
    delta.shippedOrderCountDelta += multiplier;
    delta.shippedItemCountDelta += quantity * multiplier;
  }

  return delta;
}

export function buildShipmentSummaryDelta({
  allOrderItems,
  fromOrderStatus,
  toOrderStatus,
}: {
  allOrderItems: readonly OrderItemLike[];
  fromOrderStatus: OrderStatus;
  toOrderStatus: OrderStatus;
}): ShipmentSummaryDelta {
  const quantity = getTotalItemQuantity(allOrderItems);
  const beforeBucket = getShipmentSummaryBucket(fromOrderStatus);
  const afterBucket = getShipmentSummaryBucket(toOrderStatus);

  const delta: ShipmentSummaryDelta = {
    pendingOrderCountDelta: 0,
    pendingItemCountDelta: 0,
    readyToShipOrderCountDelta: 0,
    readyToShipItemCountDelta: 0,
    shippedOrderCountDelta: 0,
    shippedItemCountDelta: 0,
    completedOrderCountDelta:
      Number(toOrderStatus === "COMPLETED") -
      Number(fromOrderStatus === "COMPLETED"),
    totalOrderCountDelta:
      Number(isShipmentRelevantOrder(toOrderStatus)) -
      Number(isShipmentRelevantOrder(fromOrderStatus)),
  };

  applyBucketDelta(delta, beforeBucket, quantity, -1);
  applyBucketDelta(delta, afterBucket, quantity, 1);

  return delta;
}

export function buildShipmentSummaryTransactItem({
  customerId,
  customerNameSnapshot,
  now,
  summaryResult,
  summaryTableName,
  delta,
  latestReadyToShipReceivedAt,
  latestShippedAt,
}: {
  customerId: string;
  customerNameSnapshot: string;
  now: string;
  summaryResult?: GetItemCommandOutput;
  summaryTableName: string;
  delta: ShipmentSummaryDelta;
  latestReadyToShipReceivedAt?: string | null;
  latestShippedAt?: string | null;
}): TransactWriteItem | null {
  const rawSummary = summaryResult?.Item ? unmarshall(summaryResult.Item) : null;
  const existingSummary = rawSummary
    ? ({
        customerId: String(rawSummary["customerId"] ?? customerId),
        customerNameSnapshot: String(
          rawSummary["customerNameSnapshot"] ?? customerNameSnapshot,
        ),
        pendingOrderCount: Number(rawSummary["pendingOrderCount"] ?? 0),
        pendingItemCount: Number(rawSummary["pendingItemCount"] ?? 0),
        readyToShipOrderCount: Number(rawSummary["readyToShipOrderCount"] ?? 0),
        readyToShipItemCount: Number(rawSummary["readyToShipItemCount"] ?? 0),
        latestReadyToShipReceivedAt: rawSummary["latestReadyToShipReceivedAt"]
          ? String(rawSummary["latestReadyToShipReceivedAt"])
          : undefined,
        shippedOrderCount: Number(rawSummary["shippedOrderCount"] ?? 0),
        shippedItemCount: Number(rawSummary["shippedItemCount"] ?? 0),
        latestShippedAt: rawSummary["latestShippedAt"]
          ? String(rawSummary["latestShippedAt"])
          : undefined,
        completedOrderCount: Number(rawSummary["completedOrderCount"] ?? 0),
        totalOrderCount: Number(rawSummary["totalOrderCount"] ?? 0),
        createdAt: rawSummary["createdAt"]
          ? String(rawSummary["createdAt"])
          : undefined,
      } satisfies ShipmentSummaryRecord)
    : null;

  const nextSummary = {
    pendingOrderCount:
      (existingSummary?.pendingOrderCount ?? 0) + delta.pendingOrderCountDelta,
    pendingItemCount:
      (existingSummary?.pendingItemCount ?? 0) + delta.pendingItemCountDelta,
    readyToShipOrderCount:
      (existingSummary?.readyToShipOrderCount ?? 0) +
      delta.readyToShipOrderCountDelta,
    readyToShipItemCount:
      (existingSummary?.readyToShipItemCount ?? 0) +
      delta.readyToShipItemCountDelta,
    shippedOrderCount:
      (existingSummary?.shippedOrderCount ?? 0) + delta.shippedOrderCountDelta,
    shippedItemCount:
      (existingSummary?.shippedItemCount ?? 0) + delta.shippedItemCountDelta,
    completedOrderCount:
      (existingSummary?.completedOrderCount ?? 0) +
      delta.completedOrderCountDelta,
    totalOrderCount:
      (existingSummary?.totalOrderCount ?? 0) + delta.totalOrderCountDelta,
  };

  if (
    nextSummary.pendingOrderCount < 0 ||
    nextSummary.pendingItemCount < 0 ||
    nextSummary.readyToShipOrderCount < 0 ||
    nextSummary.readyToShipItemCount < 0 ||
    nextSummary.shippedOrderCount < 0 ||
    nextSummary.shippedItemCount < 0 ||
    nextSummary.completedOrderCount < 0 ||
    nextSummary.totalOrderCount < 0
  ) {
    throw new Error("客戶出貨摘要計數異常，無法更新");
  }

  const shouldDelete =
    nextSummary.pendingOrderCount === 0 &&
    nextSummary.pendingItemCount === 0 &&
    nextSummary.readyToShipOrderCount === 0 &&
    nextSummary.readyToShipItemCount === 0 &&
    nextSummary.shippedOrderCount === 0 &&
    nextSummary.shippedItemCount === 0 &&
    nextSummary.completedOrderCount === 0 &&
    nextSummary.totalOrderCount === 0;

  if (shouldDelete) {
    if (!existingSummary) {
      return null;
    }

    return {
      Delete: {
        TableName: summaryTableName,
        Key: marshall({ id: customerId }),
      },
    };
  }

  const item = {
    id: customerId,
    customerId,
    customerNameSnapshot,
    pendingOrderCount: nextSummary.pendingOrderCount,
    pendingItemCount: nextSummary.pendingItemCount,
    readyToShipOrderCount: nextSummary.readyToShipOrderCount,
    readyToShipItemCount: nextSummary.readyToShipItemCount,
    latestReadyToShipReceivedAt:
      latestReadyToShipReceivedAt === undefined
        ? existingSummary?.latestReadyToShipReceivedAt
        : latestReadyToShipReceivedAt,
    shippedOrderCount: nextSummary.shippedOrderCount,
    shippedItemCount: nextSummary.shippedItemCount,
    latestShippedAt:
      latestShippedAt === undefined
        ? existingSummary?.latestShippedAt
        : latestShippedAt,
    completedOrderCount: nextSummary.completedOrderCount,
    totalOrderCount: nextSummary.totalOrderCount,
    gsiPartition: "CustomerOrderSummary",
    createdAt: existingSummary?.createdAt ?? now,
    createdAtForSort: existingSummary?.createdAt ?? now,
    updatedAt: now,
  };

  return {
    Put: {
      TableName: summaryTableName,
      Item: marshall(item),
    },
  };
}

export function deriveLatestReadyToShipReceivedAtAfterTransition({
  allOrderItems,
  orderItemId,
  toReceivedAt,
  toStatus,
}: {
  allOrderItems: readonly OrderItemLike[];
  orderItemId: string;
  toReceivedAt?: string;
  toStatus: ShipmentStatus;
}): string | undefined {
  const afterItems = allOrderItems.map((item) => ({
    id: item.id,
    status: item.id === orderItemId ? toStatus : item.status,
    quantity: item.quantity,
    receivedAt:
      item.id === orderItemId && toStatus === "received"
        ? toReceivedAt ?? item.receivedAt
        : item.receivedAt,
  }));

  return getLatestReadyToShipReceivedAt(afterItems);
}

export function deriveLatestShippedAtAfterTransition({
  allOrderItems,
  orderItemId,
  toShippedAt,
  toStatus,
}: {
  allOrderItems: readonly OrderItemLike[];
  orderItemId: string;
  toShippedAt?: string;
  toStatus: ShipmentStatus;
}): string | null {
  const afterItems = allOrderItems.map((item) => ({
    id: item.id,
    status: item.id === orderItemId ? toStatus : item.status,
    quantity: item.quantity,
    receivedAt: item.receivedAt,
    shippedAt:
      item.id === orderItemId && toStatus === "shipped"
        ? toShippedAt ?? item.shippedAt
        : item.shippedAt,
  }));

  return afterItems.reduce<string | null>((latest, item) => {
    if (item.status !== "shipped" || !item.shippedAt) {
      return latest;
    }

    if (!latest || item.shippedAt > latest) {
      return item.shippedAt;
    }

    return latest;
  }, undefined);
}
