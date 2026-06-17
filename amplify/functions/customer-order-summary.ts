import type {
  GetItemCommandOutput,
  TransactWriteItem,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { OrderStatus } from "@shared/models/order";

type ShipmentStatus = "ordered" | "received" | "shipped";

type ShipmentSummaryDelta = {
  readyToShipOrderCountDelta: number;
  completedOrderCountDelta: number;
  totalOrderCountDelta: number;
};

type ShipmentSummaryRecord = {
  customerId: string;
  customerNameSnapshot: string;
  readyToShipOrderCount: number;
  receivedItemCount: number;
  latestReceivedAt?: string;
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

function isReadyToShipOrder(status: OrderStatus): boolean {
  return status === "RECEIVED" && isShipmentRelevantOrder(status);
}

function getLatestReceivedAt(
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

function getReceivedItemCount(items: readonly OrderItemLike[]): number {
  return items.reduce((sum, item) => {
    if (item.status !== "received") {
      return sum;
    }

    return sum + Number(item.quantity ?? 0);
  }, 0);
}

export function buildShipmentSummaryDelta({
  fromOrderStatus,
  toOrderStatus,
}: {
  allOrderItems: readonly OrderItemLike[];
  fromOrderStatus: OrderStatus;
  toOrderStatus: OrderStatus;
}): ShipmentSummaryDelta {
  return {
    readyToShipOrderCountDelta:
      Number(isReadyToShipOrder(toOrderStatus)) -
      Number(isReadyToShipOrder(fromOrderStatus)),
    completedOrderCountDelta:
      Number(toOrderStatus === "COMPLETED") -
      Number(fromOrderStatus === "COMPLETED"),
    totalOrderCountDelta:
      Number(isShipmentRelevantOrder(toOrderStatus)) -
      Number(isShipmentRelevantOrder(fromOrderStatus)),
  };
}

export function buildShipmentSummaryTransactItem({
  customerId,
  customerNameSnapshot,
  now,
  summaryResult,
  summaryTableName,
  delta,
  latestReceivedAt,
  receivedItemCountDelta,
}: {
  customerId: string;
  customerNameSnapshot: string;
  now: string;
  summaryResult?: GetItemCommandOutput;
  summaryTableName: string;
  delta: ShipmentSummaryDelta;
  latestReceivedAt?: string | null;
  receivedItemCountDelta: number;
}): TransactWriteItem | null {
  const rawSummary = summaryResult?.Item ? unmarshall(summaryResult.Item) : null;
  const existingSummary = rawSummary
    ? ({
        customerId: String(rawSummary["customerId"] ?? customerId),
        customerNameSnapshot: String(
          rawSummary["customerNameSnapshot"] ?? customerNameSnapshot,
        ),
        readyToShipOrderCount: Number(rawSummary["readyToShipOrderCount"] ?? 0),
        receivedItemCount: Number(rawSummary["receivedItemCount"] ?? 0),
        latestReceivedAt: rawSummary["latestReceivedAt"]
          ? String(rawSummary["latestReceivedAt"])
          : undefined,
        completedOrderCount: Number(rawSummary["completedOrderCount"] ?? 0),
        totalOrderCount: Number(rawSummary["totalOrderCount"] ?? 0),
        createdAt: rawSummary["createdAt"]
          ? String(rawSummary["createdAt"])
          : undefined,
      } satisfies ShipmentSummaryRecord)
    : null;

  const nextSummary = {
    readyToShipOrderCount:
      (existingSummary?.readyToShipOrderCount ?? 0) +
      delta.readyToShipOrderCountDelta,
    receivedItemCount:
      (existingSummary?.receivedItemCount ?? 0) + receivedItemCountDelta,
    completedOrderCount:
      (existingSummary?.completedOrderCount ?? 0) +
      delta.completedOrderCountDelta,
    totalOrderCount:
      (existingSummary?.totalOrderCount ?? 0) + delta.totalOrderCountDelta,
  };

  if (
    nextSummary.readyToShipOrderCount < 0 ||
    nextSummary.receivedItemCount < 0 ||
    nextSummary.completedOrderCount < 0 ||
    nextSummary.totalOrderCount < 0
  ) {
    throw new Error("客戶出貨摘要計數異常，無法更新");
  }

  const shouldDelete =
    nextSummary.readyToShipOrderCount === 0 &&
    nextSummary.receivedItemCount === 0 &&
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
    readyToShipOrderCount: nextSummary.readyToShipOrderCount,
    receivedItemCount: nextSummary.receivedItemCount,
    latestReceivedAt:
      latestReceivedAt === undefined
        ? existingSummary?.latestReceivedAt
        : latestReceivedAt ??
            (nextSummary.receivedItemCount > 0
              ? existingSummary?.latestReceivedAt
              : null),
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

export function getReceivedItemCountDelta({
  quantity,
  fromStatus,
  toStatus,
}: {
  quantity: number;
  fromStatus: ShipmentStatus;
  toStatus: ShipmentStatus;
}): number {
  const wasReceived = fromStatus === "received";
  const isReceived = toStatus === "received";

  if (wasReceived === isReceived) {
    return 0;
  }

  return isReceived ? quantity : -quantity;
}

export function deriveLatestReceivedAtAfterTransition({
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

  return getLatestReceivedAt(afterItems);
}

export function deriveReceivedItemCountAfterTransition({
  allOrderItems,
  orderItemId,
  toStatus,
}: {
  allOrderItems: readonly OrderItemLike[];
  orderItemId: string;
  toStatus: ShipmentStatus;
}): number {
  const afterItems = allOrderItems.map((item) => ({
    ...item,
    status: item.id === orderItemId ? toStatus : item.status,
  }));

  return getReceivedItemCount(afterItems);
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
