import type {
  GetItemCommandOutput,
  TransactWriteItem,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { OrderStatus } from "@shared/models/order";

type ShipmentStatus = "ordered" | "received" | "shipped";

type ShipmentSummaryDelta = {
  pendingOrderCountDelta: number;
  pendingItemCountDelta: number;
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
  shippedOrderCount: number;
  shippedItemCount: number;
  completedOrderCount: number;
  totalOrderCount: number;
  createdAt?: string;
};

type OrderItemLike = {
  id: string;
  status: ShipmentStatus;
};

function hasStatus(items: readonly OrderItemLike[], status: ShipmentStatus): boolean {
  return items.some((item) => item.status === status);
}

function hasShipmentSummaryStatus(items: readonly OrderItemLike[]): boolean {
  return items.some(
    (item) => item.status === "received" || item.status === "shipped",
  );
}

export function buildShipmentSummaryDelta({
  allOrderItems,
  fromStatus,
  fromOrderStatus,
  orderItemId,
  quantity,
  toOrderStatus,
  toStatus,
}: {
  allOrderItems: readonly OrderItemLike[];
  fromStatus: ShipmentStatus;
  fromOrderStatus: OrderStatus;
  orderItemId: string;
  quantity: number;
  toOrderStatus: OrderStatus;
  toStatus: ShipmentStatus;
}): ShipmentSummaryDelta {
  const beforeItems = allOrderItems.map((item) => ({
    id: item.id,
    status: item.id === orderItemId ? fromStatus : item.status,
  }));
  const afterItems = allOrderItems.map((item) => ({
    id: item.id,
    status: item.id === orderItemId ? toStatus : item.status,
  }));

  const pendingOrderCountDelta =
    Number(hasStatus(afterItems, "received")) -
    Number(hasStatus(beforeItems, "received"));
  const shippedOrderCountDelta =
    Number(hasStatus(afterItems, "shipped")) -
    Number(hasStatus(beforeItems, "shipped"));
  const pendingItemCountDelta =
    (toStatus === "received" ? quantity : 0) -
    (fromStatus === "received" ? quantity : 0);
  const shippedItemCountDelta =
    (toStatus === "shipped" ? quantity : 0) -
    (fromStatus === "shipped" ? quantity : 0);
  const completedOrderCountDelta =
    Number(toOrderStatus === "COMPLETED") - Number(fromOrderStatus === "COMPLETED");
  const totalOrderCountDelta =
    Number(hasShipmentSummaryStatus(afterItems)) -
    Number(hasShipmentSummaryStatus(beforeItems));

  return {
    pendingOrderCountDelta,
    pendingItemCountDelta,
    shippedOrderCountDelta,
    shippedItemCountDelta,
    completedOrderCountDelta,
    totalOrderCountDelta,
  };
}

export function buildShipmentSummaryTransactItem({
  customerId,
  customerNameSnapshot,
  now,
  summaryResult,
  summaryTableName,
  delta,
}: {
  customerId: string;
  customerNameSnapshot: string;
  now: string;
  summaryResult?: GetItemCommandOutput;
  summaryTableName: string;
  delta: ShipmentSummaryDelta;
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
        shippedOrderCount: Number(rawSummary["shippedOrderCount"] ?? 0),
        shippedItemCount: Number(rawSummary["shippedItemCount"] ?? 0),
        completedOrderCount: Number(rawSummary["completedOrderCount"] ?? 0),
        totalOrderCount: Number(rawSummary["totalOrderCount"] ?? 0),
        createdAt: rawSummary["createdAt"]
          ? String(rawSummary["createdAt"])
          : undefined,
      } satisfies ShipmentSummaryRecord)
    : null;

  const nextSummary = {
    customerId,
    customerNameSnapshot,
    pendingOrderCount:
      (existingSummary?.pendingOrderCount ?? 0) + delta.pendingOrderCountDelta,
    pendingItemCount:
      (existingSummary?.pendingItemCount ?? 0) + delta.pendingItemCountDelta,
    shippedOrderCount:
      (existingSummary?.shippedOrderCount ?? 0) + delta.shippedOrderCountDelta,
    shippedItemCount:
      (existingSummary?.shippedItemCount ?? 0) + delta.shippedItemCountDelta,
    completedOrderCount:
      (existingSummary?.completedOrderCount ?? 0) + delta.completedOrderCountDelta,
    totalOrderCount:
      (existingSummary?.totalOrderCount ?? 0) + delta.totalOrderCountDelta,
  };

  if (
    nextSummary.pendingOrderCount < 0 ||
    nextSummary.pendingItemCount < 0 ||
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
    shippedOrderCount: nextSummary.shippedOrderCount,
    shippedItemCount: nextSummary.shippedItemCount,
    completedOrderCount: nextSummary.completedOrderCount,
    totalOrderCount: nextSummary.totalOrderCount,
    gsiPartition: "CustomerFulfillmentSummary",
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
