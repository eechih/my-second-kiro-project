import { client } from "@/lib/amplify-client";
import {
  calculateLineItemSubtotal,
  calculateOrderTotal,
} from "@shared/logic/order-calculations";
import { validateMergeOrders } from "@shared/logic/order-merge";
import { validateSplitOrder } from "@shared/logic/order-split";
import { isValidOrderStatusTransition } from "@shared/logic/order-status";
import {
  normalizeLineItemStatus,
  normalizeOrderStatus,
  type CreateOrderInput,
  type LineItem,
  type LineItemStatus,
  type Order,
  type OrderStatus,
  type PaginatedResult,
  type SplitAllocation,
  type StatusChange,
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

const ORDER_LIST_SELECTION_SET = ["id"] as const;

const ORDER_DETAIL_SELECTION_SET = [
  "id",
  "customerId",
  "orderNumber",
  "customerName",
  "totalAmount",
  "status",
  "statusHistory",
  "createdAt",
  "updatedAt",
  "createdAtForSort",
  "lineItems.*",
] as const;

const ORDER_VALIDATION_SELECTION_SET = [
  "id",
  "customerId",
  "orderNumber",
  "customerName",
  "totalAmount",
  "status",
  "statusHistory",
  "createdAt",
  "updatedAt",
  "createdAtForSort",
  "lineItems.*",
] as const;

// ---------------------------------------------------------------------------
// Helper Types
// ---------------------------------------------------------------------------

type UpdateOrderStatusInput = {
  orderId: string;
  currentStatus: OrderStatus;
  newStatus: OrderStatus;
  statusHistory: StatusChange[];
};

type ConfirmReceivedInput = {
  lineItemId: string;
  orderId: string;
};

type MarkProcurementInput = {
  lineItemId: string;
  orderId: string;
  supplierId: string;
  supplierName: string;
  unitCost: number;
  quantity: number;
};

type CancelProcurementInput = {
  lineItemId: string;
  orderId: string;
};

type ShipLineItemInput = {
  orderId: string;
  lineItemId: string;
  quantity: number;
};

type LineItemStatusFlag = "ordered" | "received" | "shipped" | "outOfStock";

type UpdateLineItemStatusFlagInput = {
  orderId: string;
  lineItemId: string;
  flag: LineItemStatusFlag;
  checked: boolean;
};

const NON_CANCELABLE_ORDERED_STATUSES = new Set<LineItemStatus>([
  "received",
  "shipped",
  "out_of_stock",
]);

const NON_CANCELABLE_RECEIVED_STATUSES = new Set<LineItemStatus>([
  "shipped",
  "out_of_stock",
]);

type LineItemStatusFlagUpdate = {
  purchasedAt?: string | null;
  receivedAt?: string | null;
  shippedAt?: string | null;
  shippedQuantity?: number;
  status: LineItemStatus;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  const listParams = buildOrderListParams(params);
  const {
    data,
    errors,
    nextToken: responseNextToken,
  } = await client.models.Order.listOrdersByCreatedDate(
    { gsiPartition: "Order" },
    {
      ...listParams,
      sortDirection: "DESC",
    } as Record<string, unknown>,
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢訂單列表失敗");
  }

  const items = (data ?? []).map((order) => String(order.id ?? ""));

  return {
    items,
    totalCount: items.length,
    nextToken: responseNextToken ?? undefined,
  };
}

async function fetchOrder(id: string): Promise<Order> {
  const { data, errors } = await client.models.Order.get(
    { id },
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
  const { data, errors } = await client.models.Order.get(
    { id },
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

  return {
    id: String(raw.id ?? ""),
    orderNumber: String(raw.orderNumber ?? ""),
    customerId: String(raw.customerId ?? ""),
    customerName: String(raw.customerName ?? ""),
    lineItems,
    totalAmount: Number(raw.totalAmount ?? 0),
    status: normalizeOrderStatus(raw.status),
    statusHistory,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

/** 將 Amplify Data 回傳的原始資料映射為 LineItem 型別 */
function mapToLineItem(raw: Record<string, unknown>): LineItem {
  return {
    id: String(raw.id ?? ""),
    productId: String(raw.productId ?? ""),
    productName: String(raw.productName ?? ""),
    variantId: raw.variantId ? String(raw.variantId) : null,
    variantLabel: raw.variantLabel ? String(raw.variantLabel) : null,
    quantity: Number(raw.quantity ?? 0),
    unitPrice: Number(raw.unitPrice ?? 0),
    subtotal: Number(raw.subtotal ?? 0),
    status: normalizeLineItemStatus(raw.status),
    purchasedQuantity: Number(raw.purchasedQuantity ?? 0),
    shippedQuantity: Number(raw.shippedQuantity ?? 0),
    purchasedAt: raw.purchasedAt ? String(raw.purchasedAt) : null,
    receivedAt: raw.receivedAt ? String(raw.receivedAt) : null,
    shippedAt: raw.shippedAt ? String(raw.shippedAt) : null,
    supplierId: raw.supplierId ? String(raw.supplierId) : null,
    supplierName: raw.supplierName ? String(raw.supplierName) : null,
    unitCost: raw.unitCost != null ? Number(raw.unitCost) : null,
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
      status: "pending" as const,
      purchasedQuantity: 0,
      shippedQuantity: 0,
      purchasedAt: null,
      receivedAt: null,
      shippedAt: null,
      variantId: item.variantId ?? null,
      variantLabel: item.variantLabel ?? null,
      supplierId: null,
      supplierName: null,
      unitCost: null,
    })),
  );

  const orderNumber = generateOrderNumber();
  const now = new Date().toISOString();

  const { data: orderData, errors: orderErrors } =
    await client.models.Order.create({
      customerId: input.customerId,
      orderNumber,
      customerName: input.customerName,
      totalAmount,
      status: "pending",
      statusHistory: JSON.stringify([]),
      gsiPartition: "Order",
      createdAtForSort: now,
    });

  if (orderErrors && orderErrors.length > 0) {
    throw new Error(orderErrors[0]?.message ?? "建立訂單失敗");
  }

  if (!orderData) {
    throw new Error("建立訂單失敗：未回傳資料");
  }

  const orderId = String(orderData.id ?? "");
  if (!orderId) {
    throw new Error("建立訂單失敗：未回傳訂單 ID");
  }

  const createdLineItems: LineItem[] = [];
  for (const item of lineItemsWithSubtotal) {
    const { data: lineItemData, errors: lineItemErrors } =
      await client.models.LineItem.create({
        orderId,
        productId: item.productId,
        productName: item.productName,
        variantId: item.variantId ?? null,
        variantLabel: item.variantLabel ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        status: "pending",
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
    id: orderId,
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
  const { orderId, currentStatus, newStatus, statusHistory } = input;

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
    id: orderId,
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

async function confirmReceived(input: ConfirmReceivedInput): Promise<unknown> {
  const { data, errors } = await client.mutations.confirmReceived({
    lineItemId: input.lineItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "入庫確認失敗");
  }

  return data;
}

function assertCustomMutationSuccess(
  result: unknown,
  fallbackMessage: string,
): void {
  if (typeof result !== "string") {
    return;
  }

  let parsed: { success?: boolean; message?: string };
  try {
    parsed = JSON.parse(result) as { success?: boolean; message?: string };
  } catch {
    return;
  }

  if (parsed.success === false) {
    throw new Error(parsed.message ?? fallbackMessage);
  }
}

async function cancelReceived(input: ConfirmReceivedInput): Promise<LineItem> {
  const { data: result, errors } = await client.mutations.cancelReceived({
    lineItemId: input.lineItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消到貨失敗");
  }

  assertCustomMutationSuccess(result, "取消到貨失敗");

  const { data, errors: getErrors } = await client.models.LineItem.get({
    id: input.lineItemId,
  });

  if (getErrors && getErrors.length > 0) {
    throw new Error(getErrors[0]?.message ?? "查詢明細狀態失敗");
  }

  if (!data) {
    throw new Error("取消到貨失敗：找不到明細項目");
  }

  return mapToLineItem(data as unknown as Record<string, unknown>);
}

async function markProcurement(input: MarkProcurementInput): Promise<LineItem> {
  const { data, errors } = await client.models.LineItem.update({
    id: input.lineItemId,
    status: "ordered",
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    unitCost: input.unitCost,
    purchasedQuantity: input.quantity,
    purchasedAt: new Date().toISOString(),
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "採購下單失敗");
  }

  if (!data) {
    throw new Error("採購下單失敗：未回傳資料");
  }

  return mapToLineItem(data as unknown as Record<string, unknown>);
}

async function cancelProcurement(input: CancelProcurementInput): Promise<LineItem> {
  const { data, errors } = await client.models.LineItem.update({
    id: input.lineItemId,
    status: "out_of_stock",
    purchasedQuantity: 0,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消採購失敗");
  }

  if (!data) {
    throw new Error("取消採購失敗：未回傳資料");
  }

  return mapToLineItem(data as unknown as Record<string, unknown>);
}

function buildLineItemStatusFlagUpdate(
  lineItem: Pick<
    LineItem,
    "purchasedAt" | "quantity" | "status" | "shippedQuantity"
  >,
  flag: LineItemStatusFlag,
  checked: boolean,
  now: string,
): LineItemStatusFlagUpdate {
  if (flag === "ordered") {
    if (!checked && NON_CANCELABLE_ORDERED_STATUSES.has(lineItem.status)) {
      throw new Error(`明細項目目前狀態為「${lineItem.status}」，不可取消訂貨`);
    }

    if (checked && lineItem.status === "out_of_stock") {
      throw new Error("缺貨明細不可標記訂貨");
    }

    return {
      purchasedAt: checked ? now : null,
      status: checked ? "ordered" : "pending",
    };
  }

  if (flag === "received") {
    if (!checked && NON_CANCELABLE_RECEIVED_STATUSES.has(lineItem.status)) {
      throw new Error(`明細項目目前狀態為「${lineItem.status}」，不可取消到貨`);
    }

    if (checked && lineItem.status !== "ordered") {
      throw new Error("請先標記訂貨，才能標記到貨");
    }

    return {
      receivedAt: checked ? now : null,
      status: checked ? "received" : "ordered",
    };
  }

  if (flag === "outOfStock") {
    if (checked) {
      if (lineItem.status !== "pending" && lineItem.status !== "ordered") {
        throw new Error("僅待處理或已訂購明細可標記斷貨");
      }

      return {
        status: "out_of_stock",
      };
    }

    if (lineItem.status !== "out_of_stock") {
      throw new Error("僅缺貨明細可取消斷貨");
    }

    return {
      status: lineItem.purchasedAt ? "ordered" : "pending",
    };
  }

  if (checked && lineItem.status !== "received") {
    throw new Error("請先標記到貨，才能標記出貨");
  }

  if (!checked && lineItem.status === "out_of_stock") {
    throw new Error("缺貨明細不可取消出貨");
  }

  return {
    shippedAt: checked ? now : null,
    shippedQuantity: checked ? lineItem.quantity : 0,
    status: checked ? "shipped" : "received",
  };
}

async function updateLineItemStatusFlag(
  input: UpdateLineItemStatusFlagInput,
): Promise<LineItem> {
  if (input.flag === "received" && !input.checked) {
    return cancelReceived(input);
  }

  const now = new Date().toISOString();
  const { data: currentLineItem, errors: getErrors } =
    await client.models.LineItem.get({
      id: input.lineItemId,
    });

  if (getErrors && getErrors.length > 0) {
    throw new Error(getErrors[0]?.message ?? "查詢明細狀態失敗");
  }

  if (!currentLineItem) {
    throw new Error("更新明細狀態失敗：找不到明細項目");
  }

  const update = buildLineItemStatusFlagUpdate(
    {
      purchasedAt: currentLineItem.purchasedAt
        ? String(currentLineItem.purchasedAt)
        : null,
      quantity: Number(currentLineItem.quantity ?? 0),
      shippedQuantity: Number(currentLineItem.shippedQuantity ?? 0),
      status: normalizeLineItemStatus(currentLineItem.status),
    },
    input.flag,
    input.checked,
    now,
  );

  const { data, errors } = await client.models.LineItem.update({
    id: input.lineItemId,
    ...update,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "更新明細狀態失敗");
  }

  if (!data) {
    throw new Error("更新明細狀態失敗：未回傳資料");
  }

  return mapToLineItem(data as unknown as Record<string, unknown>);
}

async function shipLineItem(input: ShipLineItemInput): Promise<unknown> {
  const { data, errors } = await client.mutations.shipLineItem({
    orderId: input.orderId,
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
    orderIds: input.orderIds,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "合併訂單失敗");
  }

  if (!data) {
    throw new Error("合併訂單失敗：未回傳資料");
  }

  const result = typeof data === "string" ? JSON.parse(data) : (data as unknown);
  const resultRecord = result as Record<string, unknown>;
  const orderData =
    resultRecord.data && typeof resultRecord.data === "object"
      ? (resultRecord.data as Record<string, unknown>)
      : resultRecord;
  if (resultRecord.success === false) {
    throw new Error(String(resultRecord.message ?? "合併訂單失敗"));
  }
  return mapToOrder(orderData);
}

async function splitOrder(input: {
  orderId: string;
  allocations: SplitAllocation[];
}): Promise<Order[]> {
  const order = await fetchOrderForValidation(input.orderId);
  const validation = validateSplitOrder(order, input.allocations);
  if (!validation.valid) {
    throw new Error(validation.error ?? "分拆驗證失敗");
  }

  const { data, errors } = await client.mutations.splitOrder({
    orderId: input.orderId,
    allocations: JSON.stringify(input.allocations),
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "分拆訂單失敗");
  }

  if (!data) {
    throw new Error("分拆訂單失敗：未回傳資料");
  }

  const result = typeof data === "string" ? JSON.parse(data) : (data as unknown);
  const resultRecord = result as Record<string, unknown>;
  if (resultRecord.success === false) {
    throw new Error(String(resultRecord.message ?? "分拆訂單失敗"));
  }
  const splitData = resultRecord.data ?? result;
  if (
    splitData &&
    typeof splitData === "object" &&
    Array.isArray((splitData as Record<string, unknown>).newOrders)
  ) {
    return ((splitData as Record<string, unknown>).newOrders as unknown[]).map(
      (item: unknown) => mapToOrder(item as Record<string, unknown>),
    );
  }
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
 * 單一訂單查詢 hook（含 LineItems）
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
 * 供列表頁面在游標懸停時預取訂單詳情（含 LineItems），
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
    onSuccess: (_, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(orderId),
      });
    },
  });
}

/**
 * 入庫確認 mutation hook
 *
 * 呼叫 confirmReceived custom mutation（Lambda 函式透過 DynamoDB TransactWriteItems）。
 * 實作樂觀更新：立即更新快取中的 LineItem 狀態為「已收到」。
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
        input.orderId,
      );
      await queryClient.cancelQueries({ queryKey: orderKey });

      // Snapshot previous value
      const previousOrder = queryClient.getQueryData<Order>(orderKey);

      // Optimistic update
      if (previousOrder) {
        const updatedOrder = { ...previousOrder };
        updatedOrder.lineItems = updatedOrder.lineItems.map((li) => {
          if (li.id === input.lineItemId) {
            return {
              ...li,
              status: "received" as const,
              receivedAt: new Date().toISOString(),
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
          input.orderId,
        );
        queryClient.setQueryData(orderKey, context.previousOrder);
      }
    },
    onSettled: (_, __, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      // Invalidate product caches for stock update
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/**
 * 採購下單 mutation hook
 *
 * 將「待處理」狀態的明細項目標記為已採購，設定供應商與成本資訊。
 *
 * 需求：3.1, 3.4, 3.5, 3.6, 3.7
 */
export function useMarkProcurement(): UseMutationResult<
  LineItem,
  Error,
  MarkProcurementInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markProcurement,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
    },
  });
}

/**
 * 採購取消 mutation hook
 *
 * 將「待處理」或「已訂購」狀態的明細項目標記為缺貨，並將 purchasedQuantity 歸零。
 *
 * 需求：5.1, 5.3, 5.4
 */
export function useCancelProcurement(): UseMutationResult<
  LineItem,
  Error,
  CancelProcurementInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelProcurement,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
    },
  });
}

/**
 * 更新明細快速狀態旗標。
 *
 * 用於訂單列表內的快速 checkbox 操作，更新 LineItem 的日期與狀態。
 */
export function useUpdateLineItemStatusFlag(): UseMutationResult<
  LineItem,
  Error,
  UpdateLineItemStatusFlagInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLineItemStatusFlag,
    onMutate: async (input) => {
      const orderKey = ORDER_KEYS.detail(
        input.orderId,
      );
      await queryClient.cancelQueries({ queryKey: orderKey });

      const previousOrder = queryClient.getQueryData<Order>(orderKey);
      const now = new Date().toISOString();

      if (previousOrder) {
        const targetLineItem = previousOrder.lineItems.find(
          (lineItem) => lineItem.id === input.lineItemId,
        );

        if (targetLineItem) {
          const update = buildLineItemStatusFlagUpdate(
            targetLineItem,
            input.flag,
            input.checked,
            now,
          );

          queryClient.setQueryData<Order>(orderKey, {
            ...previousOrder,
            lineItems: previousOrder.lineItems.map((lineItem) =>
              lineItem.id === input.lineItemId
                ? {
                    ...lineItem,
                    ...update,
                  }
                : lineItem,
            ),
          });
        }
      }

      return { previousOrder };
    },
    onError: (_error, input, context) => {
      if (context?.previousOrder) {
        queryClient.setQueryData(
          ORDER_KEYS.detail(input.orderId),
          context.previousOrder,
        );
      }
    },
    onSettled: (_, __, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      if (input.flag === "received") {
        void queryClient.invalidateQueries({ queryKey: ["products"] });
      }
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
        input.orderId,
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
              status: "shipped" as const,
              shippedAt: new Date().toISOString(),
            };
          }
          return li;
        });

        // Derive order status
        const allShipped = updatedOrder.lineItems.every(
          (li) => li.status === "shipped",
        );
        const someShipped = updatedOrder.lineItems.some(
          (li) => li.status === "shipped",
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
          input.orderId,
        );
        queryClient.setQueryData(orderKey, context.previousOrder);
      }
    },
    onSettled: (_, __, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
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
