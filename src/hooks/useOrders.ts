import { client } from "@/lib/amplify-client";
import {
  calculateLineItemSubtotal,
  calculateOrderTotal,
} from "@shared/logic/order-calculations";
import { validateMergeOrders } from "@shared/logic/order-merge";
import { validateSplitOrder } from "@shared/logic/order-split";
import { isValidOrderStatusTransition } from "@shared/logic/order-status";
import type {
  CreateOrderInput,
  LineItem,
  Order,
  OrderStatus,
  PaginatedResult,
  PurchaseRecord,
  SplitAllocation,
  StatusChange,
} from "@shared/models";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderStatusFilter = "all" | OrderStatus;

export interface OrderListParams {
  pageSize: number;
  nextToken?: string;
  search?: string;
  /** 訂單狀態篩選（undefined 表示全部） */
  status?: OrderStatus;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const ORDER_KEYS = {
  all: ["orders"] as const,
  lists: () => [...ORDER_KEYS.all, "list"] as const,
  list: (params: OrderListParams) => [...ORDER_KEYS.lists(), params] as const,
  details: () => [...ORDER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...ORDER_KEYS.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORDER_LIST_SELECTION_SET = ["customerId", "sortKey"] as const;

const ORDER_DETAIL_SELECTION_SET = [
  "customerId",
  "sortKey",
  "orderNumber",
  "customerName",
  "totalAmount",
  "status",
  "statusHistory",
  "createdAt",
  "updatedAt",
  "lineItems.*",
  "lineItems.purchaseRecords.*",
] as const;

const ORDER_VALIDATION_SELECTION_SET = [
  "customerId",
  "sortKey",
  "orderNumber",
  "customerName",
  "totalAmount",
  "status",
  "statusHistory",
  "createdAt",
  "updatedAt",
  "lineItems.*",
] as const;

// ---------------------------------------------------------------------------
// Helper Types
// ---------------------------------------------------------------------------

interface OrderKeyParts {
  customerId: string;
  sortKey: string;
}

type UpdateOrderStatusInput = {
  orderId: string;
  orderSortKey: string;
  currentStatus: OrderStatus;
  newStatus: OrderStatus;
  statusHistory: StatusChange[];
};

type CreatePurchaseRecordInput = {
  lineItemId: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unitCost: number;
  orderId: string;
  orderSortKey: string;
};

type ConfirmReceivedInput = {
  purchaseRecordId: string;
  purchaseRecordSortKey: string;
  lineItemId: string;
  orderId: string;
  orderSortKey: string;
};

type ShipLineItemInput = {
  orderId: string;
  orderSortKey: string;
  lineItemId: string;
  quantity: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOrderId(id: string): OrderKeyParts {
  const [customerId, sortKey] = id.split("|");
  if (!customerId || !sortKey) {
    throw new Error("無效的訂單 ID 格式");
  }

  return { customerId, sortKey };
}

function buildOrderFilter({
  search,
  status,
}: Pick<OrderListParams, "search" | "status">): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (search) {
    filter.or = [
      { orderNumber: { contains: search } },
      { customerName: { contains: search } },
    ];
  }

  if (status) {
    filter.status = { eq: status };
  }

  return filter;
}

function buildOrderListParams({
  pageSize,
  nextToken,
  search,
  status,
}: OrderListParams): Record<string, unknown> {
  const filter = buildOrderFilter({ search, status });
  const listParams: Record<string, unknown> = {
    limit: pageSize,
    selectionSet: ORDER_LIST_SELECTION_SET,
  };

  if (Object.keys(filter).length > 0) {
    listParams.filter = filter;
  }

  if (nextToken) {
    listParams.nextToken = nextToken;
  }

  return listParams;
}

async function fetchOrderList(
  params: OrderListParams,
): Promise<PaginatedResult<string>> {
  const {
    data,
    errors,
    nextToken: responseNextToken,
  } = await client.models.Order.list(buildOrderListParams(params));

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢訂單列表失敗");
  }

  const items = (data ?? []).map((order) => {
    const customerId = String(order.customerId ?? "");
    const sortKey = String(order.sortKey ?? "");
    return `${customerId}|${sortKey}`;
  });

  return {
    items,
    totalCount: items.length,
    nextToken: responseNextToken ?? undefined,
  };
}

async function fetchOrder(id: string): Promise<Order> {
  const { customerId, sortKey } = parseOrderId(id);
  const { data, errors } = await client.models.Order.get(
    { customerId, sortKey },
    { selectionSet: ORDER_DETAIL_SELECTION_SET },
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢訂單失敗");
  }

  if (!data) {
    throw new Error("找不到該訂單");
  }

  return mapToOrder(data);
}

async function fetchOrderForValidation(id: string): Promise<Order> {
  const { customerId, sortKey } = parseOrderId(id);
  const { data, errors } = await client.models.Order.get(
    { customerId, sortKey },
    { selectionSet: ORDER_VALIDATION_SELECTION_SET },
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢訂單失敗");
  }

  if (!data) {
    throw new Error(`找不到訂單：${id}`);
  }

  return mapToOrder(data);
}

/** 產生訂單編號（格式：ORD-YYYYMMDD-XXXX） */
function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${datePart}-${randomPart}`;
}

/** 將 Amplify Data 回傳的原始資料映射為 Order 型別 */
function mapToOrder(raw: Record<string, unknown>): Order {
  let statusHistory: StatusChange[] = [];
  if (raw.statusHistory) {
    try {
      statusHistory =
        typeof raw.statusHistory === "string"
          ? JSON.parse(raw.statusHistory)
          : (raw.statusHistory as StatusChange[]);
    } catch {
      statusHistory = [];
    }
  }

  let lineItems: LineItem[] = [];
  if (raw.lineItems && Array.isArray(raw.lineItems)) {
    lineItems = (raw.lineItems as Record<string, unknown>[]).map(mapToLineItem);
  }

  const customerId = String(raw.customerId ?? "");
  const sortKey = String(raw.sortKey ?? "");

  return {
    id: `${customerId}|${sortKey}`,
    orderNumber: String(raw.orderNumber ?? ""),
    customerId,
    customerName: String(raw.customerName ?? ""),
    lineItems,
    totalAmount: Number(raw.totalAmount ?? 0),
    status: (raw.status as OrderStatus) ?? "pending",
    statusHistory,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

/** 將 Amplify Data 回傳的原始資料映射為 LineItem 型別 */
function mapToLineItem(raw: Record<string, unknown>): LineItem {
  let purchaseRecords: PurchaseRecord[] = [];
  if (raw.purchaseRecords && Array.isArray(raw.purchaseRecords)) {
    purchaseRecords = (raw.purchaseRecords as Record<string, unknown>[]).map(
      mapToPurchaseRecord,
    );
  }

  return {
    id: String(raw.id ?? ""),
    productId: String(raw.productId ?? ""),
    productName: String(raw.productName ?? ""),
    variantId: raw.variantId ? String(raw.variantId) : null,
    variantLabel: raw.variantLabel ? String(raw.variantLabel) : null,
    quantity: Number(raw.quantity ?? 0),
    unitPrice: Number(raw.unitPrice ?? 0),
    subtotal: Number(raw.subtotal ?? 0),
    status: (raw.status as LineItem["status"]) ?? "待處理",
    purchasedQuantity: Number(raw.purchasedQuantity ?? 0),
    shippedQuantity: Number(raw.shippedQuantity ?? 0),
    purchaseRecords,
    orderedAt: raw.orderedAt ? String(raw.orderedAt) : null,
    receivedAt: raw.receivedAt ? String(raw.receivedAt) : null,
    shippedAt: raw.shippedAt ? String(raw.shippedAt) : null,
  };
}

/** 將 Amplify Data 回傳的原始資料映射為 PurchaseRecord 型別 */
function mapToPurchaseRecord(raw: Record<string, unknown>): PurchaseRecord {
  let statusHistory: StatusChange[] = [];
  if (raw.statusHistory) {
    try {
      statusHistory =
        typeof raw.statusHistory === "string"
          ? JSON.parse(raw.statusHistory)
          : (raw.statusHistory as StatusChange[]);
    } catch {
      statusHistory = [];
    }
  }

  return {
    id: String(raw.id ?? raw.lineItemId ?? ""),
    lineItemId: String(raw.lineItemId ?? ""),
    supplierId: String(raw.supplierId ?? ""),
    supplierName: String(raw.supplierName ?? ""),
    quantity: Number(raw.quantity ?? 0),
    unitCost: Number(raw.unitCost ?? 0),
    status: (raw.status as PurchaseRecord["status"]) ?? "pending",
    statusHistory,
    purchasedAt: String(raw.purchasedAt ?? ""),
    receivedAt: raw.receivedAt ? String(raw.receivedAt) : null,
  };
}

async function createOrder(input: CreateOrderInput): Promise<Order> {
  const lineItemsWithSubtotal = input.lineItems.map((item) => ({
    ...item,
    subtotal: calculateLineItemSubtotal(item.quantity, item.unitPrice),
  }));

  const totalAmount = calculateOrderTotal(
    lineItemsWithSubtotal.map((item) => ({
      ...item,
      id: "",
      status: "待處理" as const,
      purchasedQuantity: 0,
      shippedQuantity: 0,
      purchaseRecords: [],
      orderedAt: null,
      receivedAt: null,
      shippedAt: null,
      variantId: item.variantId ?? null,
      variantLabel: item.variantLabel ?? null,
    })),
  );

  const orderNumber = generateOrderNumber();
  const now = new Date().toISOString();
  const sortKey = `ORDER#${now}`;

  const { data: orderData, errors: orderErrors } =
    await client.models.Order.create({
      customerId: input.customerId,
      sortKey,
      orderNumber,
      customerName: input.customerName,
      totalAmount,
      status: "pending",
      statusHistory: JSON.stringify([]),
    });

  if (orderErrors && orderErrors.length > 0) {
    throw new Error(orderErrors[0]?.message ?? "建立訂單失敗");
  }

  if (!orderData) {
    throw new Error("建立訂單失敗：未回傳資料");
  }

  const createdLineItems: LineItem[] = [];
  for (const item of lineItemsWithSubtotal) {
    const { data: lineItemData, errors: lineItemErrors } =
      await client.models.LineItem.create({
        orderId: input.customerId,
        orderSortKey: sortKey,
        productId: item.productId,
        productName: item.productName,
        variantId: item.variantId ?? null,
        variantLabel: item.variantLabel ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        status: "待處理",
        purchasedQuantity: 0,
        shippedQuantity: 0,
      });

    if (lineItemErrors && lineItemErrors.length > 0) {
      throw new Error(lineItemErrors[0]?.message ?? "建立明細項目失敗");
    }

    if (lineItemData) {
      createdLineItems.push(mapToLineItem(lineItemData));
    }
  }

  return {
    id: `${input.customerId}|${sortKey}`,
    orderNumber,
    customerId: input.customerId,
    customerName: input.customerName,
    lineItems: createdLineItems,
    totalAmount,
    status: "pending",
    statusHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function updateOrderStatus(
  input: UpdateOrderStatusInput,
): Promise<Order> {
  const { orderId, orderSortKey, currentStatus, newStatus, statusHistory } =
    input;

  if (!isValidOrderStatusTransition(currentStatus, newStatus)) {
    throw new Error(
      `無法將訂單狀態從「${currentStatus}」變更為「${newStatus}」`,
    );
  }

  const now = new Date().toISOString();
  const newHistory: StatusChange[] = [
    ...statusHistory,
    { fromStatus: currentStatus, toStatus: newStatus, changedAt: now },
  ];

  const { data, errors } = await client.models.Order.update({
    customerId: orderId,
    sortKey: orderSortKey,
    status: newStatus,
    statusHistory: JSON.stringify(newHistory),
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "更新訂單狀態失敗");
  }

  if (!data) {
    throw new Error("更新訂單狀態失敗：未回傳資料");
  }

  return mapToOrder(data);
}

async function createPurchaseRecord(
  input: CreatePurchaseRecordInput,
): Promise<PurchaseRecord> {
  const now = new Date().toISOString();
  const { data, errors } = await client.models.PurchaseRecord.create({
    lineItemId: input.lineItemId,
    purchasedAt: now,
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    quantity: input.quantity,
    unitCost: input.unitCost,
    status: "pending",
    statusHistory: JSON.stringify([]),
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "建立採購記錄失敗");
  }

  if (!data) {
    throw new Error("建立採購記錄失敗：未回傳資料");
  }

  const { data: lineItemData } = await client.models.LineItem.get({
    id: input.lineItemId,
  });

  if (lineItemData) {
    const currentPurchasedQty = Number(lineItemData.purchasedQuantity ?? 0);
    await client.models.LineItem.update({
      id: input.lineItemId,
      purchasedQuantity: currentPurchasedQty + input.quantity,
      status: "已訂購",
      orderedAt: now,
    });
  }

  return mapToPurchaseRecord(data as unknown as Record<string, unknown>);
}

async function confirmReceived(input: ConfirmReceivedInput): Promise<unknown> {
  const { data, errors } = await client.mutations.confirmReceived({
    purchaseRecordId: input.purchaseRecordId,
    purchaseRecordSortKey: input.purchaseRecordSortKey,
    lineItemId: input.lineItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "入庫確認失敗");
  }

  return data;
}

async function shipLineItem(input: ShipLineItemInput): Promise<unknown> {
  const { data, errors } = await client.mutations.shipLineItem({
    orderId: input.orderId,
    orderSortKey: input.orderSortKey,
    lineItemId: input.lineItemId,
    quantity: input.quantity,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "出貨操作失敗");
  }

  return data;
}

async function mergeOrders(input: { orderIds: string[] }): Promise<Order> {
  const orders = await Promise.all(input.orderIds.map(fetchOrderForValidation));
  const validation = validateMergeOrders(orders);
  if (!validation.valid) {
    throw new Error(validation.error ?? "合併驗證失敗");
  }

  const { data, errors } = await client.mutations.mergeOrders({
    orderIds: JSON.stringify(input.orderIds.map(parseOrderId)),
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "合併訂單失敗");
  }

  if (!data) {
    throw new Error("合併訂單失敗：未回傳資料");
  }

  const result = typeof data === "string" ? JSON.parse(data) : (data as unknown);
  return mapToOrder(result as Record<string, unknown>);
}

async function splitOrder(input: {
  orderId: string;
  allocations: SplitAllocation[];
}): Promise<Order[]> {
  const { customerId, sortKey } = parseOrderId(input.orderId);
  const order = await fetchOrderForValidation(input.orderId);
  const validation = validateSplitOrder(order, input.allocations);
  if (!validation.valid) {
    throw new Error(validation.error ?? "分拆驗證失敗");
  }

  const { data, errors } = await client.mutations.splitOrder({
    orderId: customerId,
    orderSortKey: sortKey,
    allocations: JSON.stringify(input.allocations),
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "分拆訂單失敗");
  }

  if (!data) {
    throw new Error("分拆訂單失敗：未回傳資料");
  }

  const result = typeof data === "string" ? JSON.parse(data) : (data as unknown);
  if (Array.isArray(result)) {
    return result.map((item: unknown) =>
      mapToOrder(item as Record<string, unknown>),
    );
  }

  return [mapToOrder(result as Record<string, unknown>)];
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * 訂單列表查詢 hook
 *
 * 支援游標式分頁與搜尋（依訂單編號或客戶名稱）。
 *
 * 需求：4.2, 4.15
 */
export function useOrderList(
  params: OrderListParams,
): UseQueryResult<PaginatedResult<string>> {
  return useQuery({
    queryKey: ORDER_KEYS.list(params),
    queryFn: () => fetchOrderList(params),
  });
}

/**
 * 單一訂單查詢 hook（含 LineItems 與 PurchaseRecords）
 *
 * 需求：4.3, 4.4
 */
export function useOrder(id: string): UseQueryResult<Order> {
  return useQuery({
    queryKey: ORDER_KEYS.detail(id),
    queryFn: () => fetchOrder(id),
    enabled: !!id,
  });
}

/**
 * 預取訂單詳情 hook
 *
 * 供列表頁面在游標懸停時預取訂單詳情（含 LineItems、PurchaseRecords），
 * 使用 queryClient.prefetchQuery 提升進入詳情頁的流暢感。
 *
 * 需求：4.15
 */
export function usePrefetchOrder(): (orderId: string) => void {
  const queryClient = useQueryClient();

  return (orderId: string) => {
    void queryClient.prefetchQuery({
      queryKey: ORDER_KEYS.detail(orderId),
      queryFn: () => fetchOrder(orderId),
      staleTime: 30_000, // 30 秒內不重複預取
    });
  };
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * 建立訂單 mutation hook
 *
 * 建立訂單時自動計算明細小計與總金額。
 * 新明細項目初始狀態為「待處理」。
 *
 * 需求：4.1, 4.11
 */
export function useCreateOrder(): UseMutationResult<
  Order,
  Error,
  CreateOrderInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
    },
  });
}

/**
 * 更新訂單狀態 mutation hook
 *
 * 驗證狀態轉換合法性，記錄狀態歷史。
 *
 * 需求：5.2
 */
export function useUpdateOrderStatus(): UseMutationResult<
  Order,
  Error,
  UpdateOrderStatusInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrderStatus,
    onSuccess: (_, { orderId, orderSortKey }) => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(`${orderId}|${orderSortKey}`),
      });
    },
  });
}

/**
 * 建立採購記錄 mutation hook
 *
 * 使用標準 Amplify mutation 建立採購記錄。
 * 建立後更新明細狀態為「已訂購」。
 *
 * 需求：6.1, 6.2, 6.3, 6.4
 */
export function useCreatePurchaseRecord(): UseMutationResult<
  PurchaseRecord,
  Error,
  CreatePurchaseRecordInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPurchaseRecord,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(`${input.orderId}|${input.orderSortKey}`),
      });
    },
  });
}

/**
 * 入庫確認 mutation hook
 *
 * 呼叫 confirmReceived custom mutation（Lambda 函式透過 DynamoDB TransactWriteItems）。
 * 實作樂觀更新：立即更新快取中的 PurchaseRecord 狀態為 received、LineItem 狀態為「已收到」。
 *
 * 需求：4.7, 6.5, 6.6, 6.8, 6.10
 */
export function useConfirmReceived(): UseMutationResult<
  unknown,
  Error,
  ConfirmReceivedInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: confirmReceived,
    onMutate: async (input) => {
      // Cancel outgoing refetches
      const orderKey = ORDER_KEYS.detail(
        `${input.orderId}|${input.orderSortKey}`,
      );
      await queryClient.cancelQueries({ queryKey: orderKey });

      // Snapshot previous value
      const previousOrder = queryClient.getQueryData<Order>(orderKey);

      // Optimistic update
      if (previousOrder) {
        const updatedOrder = { ...previousOrder };
        updatedOrder.lineItems = updatedOrder.lineItems.map((li) => {
          if (li.id === input.lineItemId) {
            const updatedRecords = li.purchaseRecords.map((pr) => {
              if (
                pr.lineItemId === input.purchaseRecordId &&
                pr.purchasedAt === input.purchaseRecordSortKey
              ) {
                return {
                  ...pr,
                  status: "received" as const,
                  receivedAt: new Date().toISOString(),
                };
              }
              return pr;
            });
            return {
              ...li,
              status: "已收到" as const,
              receivedAt: new Date().toISOString(),
              purchaseRecords: updatedRecords,
            };
          }
          return li;
        });
        queryClient.setQueryData(orderKey, updatedOrder);
      }

      return { previousOrder };
    },
    onError: (_err, input, context) => {
      // Rollback
      if (context?.previousOrder) {
        const orderKey = ORDER_KEYS.detail(
          `${input.orderId}|${input.orderSortKey}`,
        );
        queryClient.setQueryData(orderKey, context.previousOrder);
      }
    },
    onSettled: (_, __, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(`${input.orderId}|${input.orderSortKey}`),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      // Invalidate product caches for stock update
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/**
 * 出貨操作 mutation hook
 *
 * 呼叫 shipLineItem custom mutation（Lambda 函式透過 DynamoDB TransactWriteItems）。
 * 實作樂觀更新：立即更新快取中的 LineItem 狀態為「已出貨」、扣減庫存。
 *
 * 需求：4.8, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function useShipLineItem(): UseMutationResult<
  unknown,
  Error,
  ShipLineItemInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: shipLineItem,
    onMutate: async (input) => {
      // Cancel outgoing refetches
      const orderKey = ORDER_KEYS.detail(
        `${input.orderId}|${input.orderSortKey}`,
      );
      await queryClient.cancelQueries({ queryKey: orderKey });

      // Snapshot previous value
      const previousOrder = queryClient.getQueryData<Order>(orderKey);

      // Optimistic update
      if (previousOrder) {
        const updatedOrder = { ...previousOrder };
        updatedOrder.lineItems = updatedOrder.lineItems.map((li) => {
          if (li.id === input.lineItemId) {
            const newShippedQty = li.shippedQuantity + input.quantity;
            return {
              ...li,
              shippedQuantity: newShippedQty,
              status: "已出貨" as const,
              shippedAt: new Date().toISOString(),
            };
          }
          return li;
        });

        // Derive order status
        const allShipped = updatedOrder.lineItems.every(
          (li) => li.status === "已出貨",
        );
        const someShipped = updatedOrder.lineItems.some(
          (li) => li.status === "已出貨",
        );
        if (allShipped) {
          updatedOrder.status = "completed";
        } else if (someShipped) {
          updatedOrder.status = "shipping";
        }

        queryClient.setQueryData(orderKey, updatedOrder);
      }

      return { previousOrder };
    },
    onError: (_err, input, context) => {
      // Rollback
      if (context?.previousOrder) {
        const orderKey = ORDER_KEYS.detail(
          `${input.orderId}|${input.orderSortKey}`,
        );
        queryClient.setQueryData(orderKey, context.previousOrder);
      }
    },
    onSettled: (_, __, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(`${input.orderId}|${input.orderSortKey}`),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      // Invalidate product caches for stock update
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Merge Orders Hook
// ---------------------------------------------------------------------------

/**
 * 訂單合併 mutation hook
 *
 * 呼叫 mergeOrders custom mutation（Lambda 函式透過 DynamoDB TransactWriteItems 原子性執行）：
 * - 建立新 Order（包含所有來源訂單的 LineItems，總金額為所有來源訂單加總）
 * - 搬移所有 LineItems 的 orderId 至新 Order
 * - 將所有來源 Orders 狀態變更為 cancelled，記錄狀態歷史
 *
 * 前端使用 validateMergeOrders 純函式進行提交前驗證。
 *
 * 需求：9.1, 9.2, 9.3, 9.4
 */
export function useMergeOrders(): UseMutationResult<
  Order,
  Error,
  { orderIds: string[] }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mergeOrders,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.details() });
    },
  });
}

// ---------------------------------------------------------------------------
// Split Order Hook
// ---------------------------------------------------------------------------

/**
 * 訂單分拆 mutation hook
 *
 * 呼叫 splitOrder custom mutation（Lambda 函式透過 DynamoDB TransactWriteItems 原子性執行）：
 * - 建立多筆新 Orders（各自包含指定的 LineItems）
 * - 依分配方式將 LineItems 的 orderId 更新至對應的新 Order
 * - 將原 Order 狀態變更為 cancelled，記錄狀態歷史
 *
 * 前端使用 validateSplitOrder 純函式進行提交前驗證。
 *
 * 需求：9.5, 9.6, 9.7
 */
export function useSplitOrder(): UseMutationResult<
  Order[],
  Error,
  { orderId: string; allocations: SplitAllocation[] }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: splitOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.details() });
    },
  });
}

export { ORDER_KEYS };
