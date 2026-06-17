import { client } from "@/lib/amplify-client";
import {
  calculateOrderItemSubtotal,
  calculateOrderTotal,
} from "@shared/logic/order-calculations";
import { validateMergeOrders } from "@shared/logic/order-merge";
import { validateSplitOrder } from "@shared/logic/order-split";
import {
  deriveOrderStatusFromOrderItems,
  isValidOrderStatusTransition,
} from "@shared/logic/order-status";
import {
  normalizeLegacyOrderStatus,
  normalizeOrderItemStatus,
  normalizeOrderStatus,
  normalizePaymentStatus,
  type ConfirmShipmentInput,
  type CreateOrderInput,
  type OrderItem,
  type OrderItemSelectedOptionSnapshot,
  type Order,
  type PaymentStatus,
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

export interface CustomerOrderListParams {
  customerId: string;
  pageSize: number;
  nextToken?: string;
}

export interface ProductOrderItemListParams {
  productId: string;
  pageSize: number;
  nextToken?: string;
  status?: OrderItem["status"];
  statuses?: OrderItem["status"][];
}

export interface SupplierOrderItemListParams {
  supplierName: string;
  pageSize: number;
  nextToken?: string;
  status?: "ordered" | "received";
}

export interface ProductOrderItemRecord {
  orderId: string;
  orderNumber: string;
  customerName: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  item: OrderItem;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const ORDER_KEYS = {
  all: ["orders"] as const,
  lists: () => [...ORDER_KEYS.all, "list"] as const,
  list: (params: OrderListParams) => [...ORDER_KEYS.lists(), params] as const,
  customerLists: () => [...ORDER_KEYS.all, "customer-list"] as const,
  customerList: (params: CustomerOrderListParams) =>
    [...ORDER_KEYS.customerLists(), params] as const,
  details: () => [...ORDER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...ORDER_KEYS.details(), id] as const,
  productItems: () => [...ORDER_KEYS.all, "product-items"] as const,
  productItemList: (params: ProductOrderItemListParams) =>
    [...ORDER_KEYS.productItems(), params] as const,
  supplierItems: () => [...ORDER_KEYS.all, "supplier-items"] as const,
  supplierItemList: (params: SupplierOrderItemListParams) =>
    [...ORDER_KEYS.supplierItems(), params] as const,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORDER_LIST_SELECTION_SET = ["id"] as const;

const ORDER_DETAIL_SELECTION_SET = [
  "id",
  "customerId",
  "orderNumber",
  "customerNameSnapshot",
  "totalAmount",
  "subtotalAmount",
  "status",
  "paymentStatus",
  "paidAt",
  "cancelledAt",
  "refundedAt",
  "completedAt",
  "statusHistory",
  "createdAt",
  "updatedAt",
  "createdAtForSort",
  "items.*",
] as const;

const ORDER_VALIDATION_SELECTION_SET = [
  "id",
  "customerId",
  "orderNumber",
  "customerNameSnapshot",
  "totalAmount",
  "subtotalAmount",
  "status",
  "paymentStatus",
  "paidAt",
  "cancelledAt",
  "refundedAt",
  "completedAt",
  "statusHistory",
  "createdAt",
  "updatedAt",
  "createdAtForSort",
  "items.*",
] as const;

const PRODUCT_ORDER_ITEM_SELECTION_SET = [
  "id",
  "orderId",
  "productId",
  "productNameSnapshot",
  "productImageUrlSnapshot",
  "productSkuSnapshot",
  "selectedOptionsSnapshot",
  "quantity",
  "unitPriceSnapshot",
  "unitCostSnapshot",
  "totalPriceSnapshot",
  "totalCostSnapshot",
  "status",
  "purchasedAt",
  "receivedAt",
  "shippedAt",
  "outOfStockAt",
  "supplierName",
  "createdAt",
  "updatedAt",
  "order.id",
  "order.orderNumber",
  "order.customerNameSnapshot",
  "order.status",
  "order.paymentStatus",
] as const;

// ---------------------------------------------------------------------------
// Helper Types
// ---------------------------------------------------------------------------

type UpdateOrderStatusInput = {
  orderId: string;
  currentStatus: OrderStatus;
  newStatus: OrderStatus;
  currentPaymentStatus: PaymentStatus;
  statusHistory: StatusChange[];
};

type ConfirmReceivedInput = {
  orderItemId: string;
  orderId: string;
};

type MarkProcurementInput = {
  orderItemId: string;
  orderId: string;
};

type CancelProcurementInput = {
  orderItemId: string;
  orderId: string;
};

type ConfirmShipmentBaseInput = {
  orderItemId: string;
  orderId: string;
};

type OrderItemStatusFlag = "ordered" | "received" | "shipped" | "outOfStock";

type UpdateOrderItemStatusFlagInput = {
  orderId: string;
  orderItemId: string;
  flag: OrderItemStatusFlag;
  checked: boolean;
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
      { customerNameSnapshot: { contains: search } },
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

async function fetchCustomerOrderList(
  params: CustomerOrderListParams,
): Promise<PaginatedResult<Order>> {
  const {
    data,
    errors,
    nextToken: responseNextToken,
  } = await client.models.Order.listOrdersByCustomer(
    { customerId: params.customerId },
    {
      sortDirection: "DESC",
      limit: params.pageSize,
      ...(params.nextToken ? { nextToken: params.nextToken } : {}),
      selectionSet: ORDER_DETAIL_SELECTION_SET,
    } as Record<string, unknown>,
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢客戶訂單失敗");
  }

  const items = (data ?? []).map((order) =>
    mapToOrder(order as unknown as Record<string, unknown>),
  );

  return {
    items,
    totalCount: items.length,
    nextToken: responseNextToken ?? undefined,
  };
}

export async function fetchAllCustomerOrders(
  customerId: string,
): Promise<Order[]> {
  const items: Order[] = [];
  let nextToken: string | undefined;

  do {
    const page = await fetchCustomerOrderList({
      customerId,
      pageSize: 100,
      nextToken,
    });

    items.push(...page.items);
    nextToken = page.nextToken;
  } while (nextToken);

  return items;
}

async function fetchProductOrderItemList(
  params: ProductOrderItemListParams,
): Promise<PaginatedResult<ProductOrderItemRecord>> {
  const statusFilter = params.status
    ? { status: { eq: params.status } }
    : params.statuses && params.statuses.length > 0
      ? {
          or: params.statuses.map((status) => ({
            status: { eq: status },
          })),
        }
      : undefined;

  const { data, errors, nextToken } =
    await client.models.OrderItem.listOrderItemsByProductId(
      { productId: params.productId },
      {
        sortDirection: "DESC",
        limit: params.pageSize,
        ...(params.nextToken ? { nextToken: params.nextToken } : {}),
        ...(statusFilter ? { filter: statusFilter } : {}),
        selectionSet: PRODUCT_ORDER_ITEM_SELECTION_SET,
      } as Record<string, unknown>,
    );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢單品採購資料失敗");
  }

  const items = (data ?? []).map((raw) => {
    const record = raw as unknown as Record<string, unknown>;
    const orderRaw =
      record.order && typeof record.order === "object"
        ? (record.order as Record<string, unknown>)
        : {};

    return {
      orderId: String(record.orderId ?? orderRaw.id ?? ""),
      orderNumber: String(orderRaw.orderNumber ?? ""),
      customerName: String(orderRaw.customerNameSnapshot ?? ""),
      orderStatus: normalizeLegacyOrderStatus({
        status: orderRaw.status,
        fulfillmentStatus: orderRaw.fulfillmentStatus,
      }),
      paymentStatus: normalizePaymentStatus(orderRaw.paymentStatus),
      item: mapToOrderItem(record),
    } satisfies ProductOrderItemRecord;
  });

  return {
    items,
    totalCount: items.length,
    nextToken: nextToken ?? undefined,
  };
}

function buildSupplierOrderItemFilter({
  supplierName,
  status,
}: Pick<SupplierOrderItemListParams, "supplierName" | "status">): Record<
  string,
  unknown
> {
  const trimmedSupplierName = supplierName.trim();
  const statusFilter = status
    ? { status: { eq: status } }
    : {
        or: [
          { status: { eq: "ordered" } },
          { status: { eq: "received" } },
        ],
      };

  return {
    and: [{ supplierName: { eq: trimmedSupplierName } }, statusFilter],
  };
}

async function fetchSupplierOrderItemList(
  params: SupplierOrderItemListParams,
): Promise<PaginatedResult<ProductOrderItemRecord>> {
  const { data, errors, nextToken } = await client.models.OrderItem.list({
    filter: buildSupplierOrderItemFilter(params),
    limit: params.pageSize,
    ...(params.nextToken ? { nextToken: params.nextToken } : {}),
    selectionSet: PRODUCT_ORDER_ITEM_SELECTION_SET,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢供應商入庫資料失敗");
  }

  const items = (data ?? [])
    .map((raw) => {
      const record = raw as unknown as Record<string, unknown>;
      const orderRaw =
        record.order && typeof record.order === "object"
          ? (record.order as Record<string, unknown>)
          : {};

      return {
        orderId: String(record.orderId ?? orderRaw.id ?? ""),
        orderNumber: String(orderRaw.orderNumber ?? ""),
        customerName: String(orderRaw.customerNameSnapshot ?? ""),
        orderStatus: normalizeLegacyOrderStatus({
          status: orderRaw.status,
          fulfillmentStatus: orderRaw.fulfillmentStatus,
        }),
        paymentStatus: normalizePaymentStatus(orderRaw.paymentStatus),
        item: mapToOrderItem(record),
      } satisfies ProductOrderItemRecord;
    })
    .sort((a, b) => {
      const timeA = Date.parse(
        a.item.receivedAt ?? a.item.purchasedAt ?? "1970-01-01T00:00:00.000Z",
      );
      const timeB = Date.parse(
        b.item.receivedAt ?? b.item.purchasedAt ?? "1970-01-01T00:00:00.000Z",
      );
      return timeB - timeA;
    });

  return {
    items,
    totalCount: items.length,
    nextToken: nextToken ?? undefined,
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

  let items: OrderItem[] = [];
  if (raw.items && Array.isArray(raw.items)) {
    items = (raw.items as Record<string, unknown>[]).map(mapToOrderItem);
  }

  return {
    id: String(raw.id ?? ""),
    orderNumber: String(raw.orderNumber ?? ""),
    customerId: String(raw.customerId ?? ""),
    customerName: String(raw.customerNameSnapshot ?? raw.customerName ?? ""),
    items,
    totalAmount: Number(raw.totalAmount ?? raw.subtotalAmount ?? 0),
    status: normalizeLegacyOrderStatus({
      status: raw.status,
      fulfillmentStatus: raw.fulfillmentStatus,
      cancelledAt: raw.cancelledAt,
    }),
    paymentStatus: normalizePaymentStatus(raw.paymentStatus),
    paidAt: raw.paidAt ? String(raw.paidAt) : null,
    cancelledAt: raw.cancelledAt ? String(raw.cancelledAt) : null,
    refundedAt: raw.refundedAt ? String(raw.refundedAt) : null,
    completedAt: raw.completedAt ? String(raw.completedAt) : null,
    statusHistory,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function parseSelectedOptionsSnapshot(
  raw: unknown,
): OrderItemSelectedOptionSnapshot[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed =
      typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
      .map((item) => ({
        optionName: String(item.optionName ?? ""),
        valueName: String(item.valueName ?? ""),
        priceOffset: Number(item.priceOffset ?? 0),
        costOffset: Number(item.costOffset ?? 0),
      }))
      .filter((item) => item.optionName.length > 0 && item.valueName.length > 0);
  } catch {
    return [];
  }
}

function buildVariantLabelFromSnapshot(
  snapshots: OrderItemSelectedOptionSnapshot[],
): string | null {
  if (snapshots.length === 0) {
    return null;
  }

  const names = snapshots
    .map((snapshot) => snapshot.valueName.trim())
    .filter(Boolean);

  return names.length > 0 ? names.join(" / ") : null;
}

/** 將 Amplify Data 回傳的原始資料映射為 OrderItem 型別 */
function mapToOrderItem(raw: Record<string, unknown>): OrderItem {
  const selectedOptionsSnapshot = parseSelectedOptionsSnapshot(
    raw.selectedOptionsSnapshot,
  );

  return {
    id: String(raw.id ?? ""),
    productId: String(raw.productId ?? ""),
    productName: String(raw.productNameSnapshot ?? raw.productName ?? ""),
    productImageUrl: raw.productImageUrlSnapshot
      ? String(raw.productImageUrlSnapshot)
      : null,
    productSku:
      raw.productSkuSnapshot !== undefined && raw.productSkuSnapshot !== null
        ? String(raw.productSkuSnapshot)
        : "",
    variantLabel: buildVariantLabelFromSnapshot(selectedOptionsSnapshot),
    selectedOptionsSnapshot,
    quantity: Number(raw.quantity ?? 0),
    unitPrice: Number(raw.unitPriceSnapshot ?? 0),
    unitCostSnapshot:
      raw.unitCostSnapshot != null
        ? Number(raw.unitCostSnapshot)
        : null,
    subtotal: Number(
      raw.totalPriceSnapshot ?? raw.subtotal ?? 0,
    ),
    totalCostSnapshot:
      raw.totalCostSnapshot != null ? Number(raw.totalCostSnapshot) : null,
    status: normalizeOrderItemStatus(raw.status),
    purchasedAt: raw.purchasedAt ? String(raw.purchasedAt) : null,
    receivedAt: raw.receivedAt ? String(raw.receivedAt) : null,
    shippedAt: raw.shippedAt ? String(raw.shippedAt) : null,
    outOfStockAt: raw.outOfStockAt ? String(raw.outOfStockAt) : null,
    supplierName: raw.supplierName ? String(raw.supplierName) : null,
    unitCost:
      raw.unitCostSnapshot != null
        ? Number(raw.unitCostSnapshot)
        : null,
  };
}

async function createOrder(input: CreateOrderInput): Promise<Order> {
  const orderItemsWithSubtotal = input.orderItems.map((item) => ({
    ...item,
    subtotal: calculateOrderItemSubtotal(item.quantity, item.unitPrice),
  }));

  const totalAmount = calculateOrderTotal(
    orderItemsWithSubtotal.map((item) => ({
      ...item,
      id: "",
      status: "pending" as const,
      purchasedAt: null,
      receivedAt: null,
      shippedAt: null,
      outOfStockAt: null,
      productImageUrl: item.productImageUrl ?? null,
      variantLabel: item.variantLabel ?? null,
      selectedOptionsSnapshot: item.selectedOptionsSnapshot ?? [],
      supplierName: null,
      unitCost: item.unitCost ?? null,
      unitCostSnapshot: item.unitCost ?? null,
      totalCostSnapshot:
        item.unitCost != null ? item.unitCost * item.quantity : null,
    })),
  );

  const orderNumber = generateOrderNumber();
  const now = new Date().toISOString();

  const { data: orderData, errors: orderErrors } =
    await client.models.Order.create({
      customerId: input.customerId,
      orderNumber,
      customerNameSnapshot: input.customerName,
      paymentStatus: "UNPAID",
      subtotalAmount: totalAmount,
      totalAmount,
      shippingAmount: 0,
      discountAmount: 0,
      status: "PENDING",
      statusHistory: JSON.stringify([]),
      isActive: true,
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

  const createdOrderItems: OrderItem[] = [];
  for (const item of orderItemsWithSubtotal) {
    const orderItemPayload: Record<string, unknown> = {
      orderId,
      productId: item.productId,
      productNameSnapshot: item.productName,
      productImageUrlSnapshot: item.productImageUrl ?? null,
      productSkuSnapshot: item.productSku,
      quantity: item.quantity,
      selectedOptionsSnapshot: JSON.stringify(item.selectedOptionsSnapshot ?? []),
      unitPriceSnapshot: item.unitPrice,
      unitCostSnapshot: item.unitCost ?? null,
      totalPriceSnapshot: item.subtotal,
      totalCostSnapshot:
        item.unitCost != null ? item.unitCost * item.quantity : null,
      status: "pending",
      createdAtForSort: now,
    };

    const { data: orderItemData, errors: orderItemErrors } =
      await client.models.OrderItem.create(
        orderItemPayload as Parameters<typeof client.models.OrderItem.create>[0],
      );

    if (orderItemErrors && orderItemErrors.length > 0) {
      throw new Error(orderItemErrors[0]?.message ?? "建立明細項目失敗");
    }

    if (orderItemData) {
      createdOrderItems.push(mapToOrderItem(orderItemData));
    }
  }

  const { data: customerData, errors: customerErrors } =
    await client.models.Customer.get({ id: input.customerId });

  if (customerErrors && customerErrors.length > 0) {
    throw new Error(customerErrors[0]?.message ?? "更新客戶下單時間失敗");
  }

  if (customerData) {
    const nextOrderCount = Number(customerData.orderCount ?? 0) + 1;
    const { errors: customerUpdateErrors } = await client.models.Customer.update({
      id: input.customerId,
      orderCount: nextOrderCount,
      orderCountForSort: nextOrderCount,
      lastOrderedAt: now,
      lastOrderedAtForSort: now,
    });

    if (customerUpdateErrors && customerUpdateErrors.length > 0) {
      throw new Error(
        customerUpdateErrors[0]?.message ?? "更新客戶下單時間失敗",
      );
    }
  }

  return {
    id: orderId,
    orderNumber,
    customerId: input.customerId,
    customerName: input.customerName,
    items: createdOrderItems,
    totalAmount,
    status: "PENDING",
    paymentStatus: "UNPAID",
    paidAt: null,
    cancelledAt: null,
    refundedAt: null,
    completedAt: null,
    statusHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function updateOrderStatus(
  input: UpdateOrderStatusInput,
): Promise<Order> {
  const {
    orderId,
    currentStatus,
    newStatus,
    currentPaymentStatus,
    statusHistory,
  } = input;

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

  let paymentStatus = currentPaymentStatus;
  let paidAt: string | null | undefined;
  let cancelledAt: string | null | undefined;
  let refundedAt: string | null | undefined;
  let completedAt: string | null | undefined;

  switch (newStatus) {
    case "PENDING":
      paymentStatus = "UNPAID";
      paidAt = null;
      cancelledAt = null;
      refundedAt = null;
      completedAt = null;
      break;
    case "ORDERED":
    case "RECEIVED":
    case "SHIPPED":
      paymentStatus = "PAID";
      paidAt = paidAt ?? now;
      cancelledAt = null;
      refundedAt = null;
      break;
    case "COMPLETED":
      paymentStatus = "PAID";
      paidAt = paidAt ?? now;
      cancelledAt = null;
      completedAt = now;
      break;
    case "OUT_OF_STOCK":
      cancelledAt = null;
      break;
    case "CANCELLED":
      cancelledAt = now;
      break;
  }

  const { data, errors } = await client.models.Order.update({
    id: orderId,
    status: newStatus,
    paymentStatus,
    paidAt,
    cancelledAt,
    refundedAt,
    completedAt,
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

async function confirmReceived(input: ConfirmReceivedInput): Promise<OrderItem> {
  const { data, errors } = await client.mutations.confirmReceived({
    orderItemId: input.orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "入庫確認失敗");
  }

  assertCustomMutationSuccess(data, "入庫確認失敗");

  return fetchOrderItemAfterCustomMutation(
    input.orderItemId,
    "入庫確認失敗：找不到明細項目",
  );
}

function parseCustomMutationResult(
  result: unknown,
): Record<string, unknown> | null {
  let current = result;

  for (let i = 0; i < 3; i++) {
    if (typeof current === "string") {
      try {
        current = JSON.parse(current) as unknown;
      } catch {
        return null;
      }
      continue;
    }

    if (current && typeof current === "object" && !Array.isArray(current)) {
      return current as Record<string, unknown>;
    }

    return null;
  }

  return null;
}

function assertCustomMutationSuccess(
  result: unknown,
  fallbackMessage: string,
): void {
  const parsed = parseCustomMutationResult(result);
  if (!parsed) {
    return;
  }

  if (parsed.success === false) {
    throw new Error(String(parsed.message ?? fallbackMessage));
  }
}

async function cancelReceived(input: ConfirmReceivedInput): Promise<OrderItem> {
  const { data: result, errors } = await client.mutations.cancelReceived({
    orderItemId: input.orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消到貨失敗");
  }

  assertCustomMutationSuccess(result, "取消到貨失敗");

  const { data, errors: getErrors } = await client.models.OrderItem.get({
    id: input.orderItemId,
  });

  if (getErrors && getErrors.length > 0) {
    throw new Error(getErrors[0]?.message ?? "查詢明細狀態失敗");
  }

  if (!data) {
    throw new Error("取消到貨失敗：找不到明細項目");
  }

  return mapToOrderItem(data as unknown as Record<string, unknown>);
}

async function fetchOrderItemAfterCustomMutation(
  orderItemId: string,
  fallbackMessage: string,
): Promise<OrderItem> {
  const { data, errors } = await client.models.OrderItem.get({
    id: orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢明細狀態失敗");
  }

  if (!data) {
    throw new Error(fallbackMessage);
  }

  return mapToOrderItem(data as unknown as Record<string, unknown>);
}

async function confirmOutOfStock(
  input: Pick<UpdateOrderItemStatusFlagInput, "orderItemId">,
): Promise<OrderItem> {
  const { data: result, errors } = await client.mutations.confirmOutOfStock({
    orderItemId: input.orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "確認缺貨失敗");
  }

  assertCustomMutationSuccess(result, "確認缺貨失敗");

  return fetchOrderItemAfterCustomMutation(
    input.orderItemId,
    "確認缺貨失敗：找不到明細項目",
  );
}

async function cancelOutOfStock(
  input: Pick<UpdateOrderItemStatusFlagInput, "orderItemId">,
): Promise<OrderItem> {
  const { data: result, errors } = await client.mutations.cancelOutOfStock({
    orderItemId: input.orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消缺貨失敗");
  }

  assertCustomMutationSuccess(result, "取消缺貨失敗");

  return fetchOrderItemAfterCustomMutation(
    input.orderItemId,
    "取消缺貨失敗：找不到明細項目",
  );
}

async function confirmPurchase(
  input: Pick<MarkProcurementInput, "orderItemId">,
): Promise<OrderItem> {
  const { data: result, errors } = await client.mutations.confirmPurchase({
    orderItemId: input.orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "採購下單失敗");
  }

  assertCustomMutationSuccess(result, "採購下單失敗");

  return fetchOrderItemAfterCustomMutation(
    input.orderItemId,
    "採購下單失敗：找不到明細項目",
  );
}

async function markProcurement(input: MarkProcurementInput): Promise<OrderItem> {
  return confirmPurchase(input);
}

async function cancelProcurement(
  input: CancelProcurementInput,
): Promise<OrderItem> {
  const { data: result, errors } = await client.mutations.cancelPurchase({
    orderItemId: input.orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消採購失敗");
  }

  assertCustomMutationSuccess(result, "取消採購失敗");

  return fetchOrderItemAfterCustomMutation(
    input.orderItemId,
    "取消採購失敗：找不到明細項目",
  );
}

function buildOrderItemStatusFlagOptimisticUpdate(
  orderItem: OrderItem,
  flag: OrderItemStatusFlag,
  checked: boolean,
  now: string,
): Partial<OrderItem> {
  if (flag === "ordered") {
    return checked
      ? {
          status: "ordered",
          purchasedAt: now,
        }
      : {
          status: "pending",
          purchasedAt: null,
          supplierName: null,
          unitCost: null,
        };
  }

  if (flag === "received") {
    return checked
      ? { status: "received", receivedAt: now }
      : { status: "ordered", receivedAt: null };
  }

  if (flag === "shipped") {
    return checked
      ? {
          status: "shipped",
          shippedAt: now,
        }
      : {
          status: "received",
          shippedAt: null,
        };
  }

  return checked
    ? { status: "out_of_stock", outOfStockAt: now }
    : {
        status: orderItem.receivedAt
          ? "received"
          : orderItem.purchasedAt
            ? "ordered"
            : "pending",
        outOfStockAt: null,
      };
}

async function updateOrderItemStatusFlag(
  input: UpdateOrderItemStatusFlagInput,
): Promise<OrderItem> {
  if (input.flag === "ordered") {
    return input.checked ? confirmPurchase(input) : cancelProcurement(input);
  }

  if (input.flag === "received") {
    return input.checked ? confirmReceived(input) : cancelReceived(input);
  }

  if (input.flag === "shipped") {
    return input.checked
      ? confirmShipmentRemaining({
          orderId: input.orderId,
          orderItemId: input.orderItemId,
        })
      : cancelShipment({
          orderId: input.orderId,
          orderItemId: input.orderItemId,
        });
  }

  if (input.flag === "outOfStock") {
    return input.checked ? confirmOutOfStock(input) : cancelOutOfStock(input);
  }

  throw new Error("不支援的明細狀態操作");
}

async function confirmShipment(input: {
  orderItemId: string;
}): Promise<OrderItem> {
  const { data, errors } = await client.mutations.confirmShipment({
    orderItemId: input.orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "出貨操作失敗");
  }

  assertCustomMutationSuccess(data, "出貨操作失敗");

  return fetchOrderItemAfterCustomMutation(
    input.orderItemId,
    "出貨操作失敗：找不到明細項目",
  );
}

async function confirmShipmentRemaining(
  input: ConfirmShipmentBaseInput,
): Promise<OrderItem> {
  return confirmShipment({
    orderItemId: input.orderItemId,
  });
}

async function cancelShipment(
  input: ConfirmShipmentBaseInput,
): Promise<OrderItem> {
  const { data: result, errors } = await client.mutations.cancelShipment({
    orderItemId: input.orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消出貨失敗");
  }

  assertCustomMutationSuccess(result, "取消出貨失敗");

  const { data, errors: getErrors } = await client.models.OrderItem.get({
    id: input.orderItemId,
  });

  if (getErrors && getErrors.length > 0) {
    throw new Error(getErrors[0]?.message ?? "查詢明細狀態失敗");
  }

  if (!data) {
    throw new Error("取消出貨失敗：找不到明細項目");
  }

  return mapToOrderItem(data as unknown as Record<string, unknown>);
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

  const resultRecord = parseCustomMutationResult(data) ?? {};
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

  const resultRecord = parseCustomMutationResult(data) ?? {};
  if (resultRecord.success === false) {
    throw new Error(String(resultRecord.message ?? "分拆訂單失敗"));
  }
  const splitData = resultRecord.data ?? resultRecord;
  if (
    splitData &&
    typeof splitData === "object" &&
    Array.isArray((splitData as Record<string, unknown>).newOrders)
  ) {
    return ((splitData as Record<string, unknown>).newOrders as unknown[]).map(
      (item: unknown) => mapToOrder(item as Record<string, unknown>),
    );
  }
  return [mapToOrder(resultRecord)];
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

export function useCustomerOrderList(
  params: CustomerOrderListParams,
): UseQueryResult<PaginatedResult<Order>> {
  return useQuery({
    queryKey: ORDER_KEYS.customerList(params),
    queryFn: () => fetchCustomerOrderList(params),
    enabled: !!params.customerId,
  });
}

export function useProductOrderItemList(
  params: ProductOrderItemListParams,
): UseQueryResult<PaginatedResult<ProductOrderItemRecord>> {
  return useQuery({
    queryKey: ORDER_KEYS.productItemList(params),
    queryFn: () => fetchProductOrderItemList(params),
    enabled: !!params.productId,
  });
}

export function useSupplierOrderItemList(
  params: SupplierOrderItemListParams,
): UseQueryResult<PaginatedResult<ProductOrderItemRecord>> {
  return useQuery({
    queryKey: ORDER_KEYS.supplierItemList(params),
    queryFn: () => fetchSupplierOrderItemList(params),
    enabled: params.supplierName.trim().length > 0,
  });
}

/**
 * 單一訂單查詢 hook（含 OrderItems）
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
 * 供列表頁面在游標懸停時預取訂單詳情（含 OrderItems），
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
 * 實作樂觀更新：立即更新快取中的 OrderItem 狀態為「已收到」。
 *
 * 需求：4.7, 6.5, 6.6, 6.8, 6.10
 */
export function useConfirmReceived(): UseMutationResult<
  OrderItem,
  Error,
  ConfirmReceivedInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: confirmReceived,
    onMutate: async (input) => {
      // Cancel outgoing refetches
      const orderKey = ORDER_KEYS.detail(input.orderId);
      await queryClient.cancelQueries({ queryKey: orderKey });

      // Snapshot previous value
      const previousOrder = queryClient.getQueryData<Order>(orderKey);

      // Optimistic update
      if (previousOrder) {
        const updatedOrder = { ...previousOrder };
        updatedOrder.items = updatedOrder.items.map((li) => {
          if (li.id === input.orderItemId) {
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
        const orderKey = ORDER_KEYS.detail(input.orderId);
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
  OrderItem,
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
 * 將「已訂購」狀態的明細項目恢復為待處理，並清除採購資料。
 *
 * 需求：5.1, 5.3, 5.4
 */
export function useCancelProcurement(): UseMutationResult<
  OrderItem,
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
 * 用於訂單列表內的快速 checkbox 操作，更新 OrderItem 的日期與狀態。
 */
export function useUpdateOrderItemStatusFlag(): UseMutationResult<
  OrderItem,
  Error,
  UpdateOrderItemStatusFlagInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrderItemStatusFlag,
    onMutate: async (input) => {
      const orderKey = ORDER_KEYS.detail(input.orderId);
      await queryClient.cancelQueries({ queryKey: orderKey });

      const previousOrder = queryClient.getQueryData<Order>(orderKey);
      const now = new Date().toISOString();

      if (previousOrder) {
        const targetOrderItem = previousOrder.items.find(
          (orderItem) => orderItem.id === input.orderItemId,
        );

        if (targetOrderItem) {
          const update = buildOrderItemStatusFlagOptimisticUpdate(
            targetOrderItem,
            input.flag,
            input.checked,
            now,
          );

          queryClient.setQueryData<Order>(orderKey, {
            ...previousOrder,
            items: previousOrder.items.map((orderItem) =>
              orderItem.id === input.orderItemId
                ? {
                    ...orderItem,
                    ...update,
                  }
                : orderItem,
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
      if (input.flag === "received" || input.flag === "shipped") {
        void queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    },
  });
}

/**
 * 出貨操作 mutation hook
 *
 * 呼叫 confirmShipment custom mutation（Lambda 函式透過 DynamoDB TransactWriteItems）。
 * 實作樂觀更新：立即更新快取中的 OrderItem 狀態為「已出貨」、扣減庫存。
 *
 * 需求：4.8, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function useConfirmShipment(): UseMutationResult<
  OrderItem,
  Error,
  ConfirmShipmentInput & { orderId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => confirmShipment({ orderItemId: input.orderItemId }),
    onMutate: async (input) => {
      // Cancel outgoing refetches
      const orderKey = ORDER_KEYS.detail(input.orderId);
      await queryClient.cancelQueries({ queryKey: orderKey });

      // Snapshot previous value
      const previousOrder = queryClient.getQueryData<Order>(orderKey);

      // Optimistic update
      if (previousOrder) {
        const updatedOrder = { ...previousOrder };
        updatedOrder.items = updatedOrder.items.map((li) => {
          if (li.id === input.orderItemId) {
            return {
              ...li,
              status: "shipped" as const,
              shippedAt: new Date().toISOString(),
            };
          }
          return li;
        });

        updatedOrder.status = deriveOrderStatusFromOrderItems(updatedOrder.items);

        queryClient.setQueryData(orderKey, updatedOrder);
      }

      return { previousOrder };
    },
    onError: (_err, input, context) => {
      // Rollback
      if (context?.previousOrder) {
        const orderKey = ORDER_KEYS.detail(input.orderId);
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
 * - 建立新 Order（包含所有來源訂單的 OrderItems，總金額為所有來源訂單加總）
 * - 搬移所有 OrderItems 的 orderId 至新 Order
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
 * - 建立多筆新 Orders（各自包含指定的 OrderItems）
 * - 依分配方式將 OrderItems 的 orderId 更新至對應的新 Order
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

// ---------------------------------------------------------------------------
// Order Item CRUD Hooks (Order Detail)
// ---------------------------------------------------------------------------

type AddOrderItemToOrderInput = {
  orderId: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  productSku: string;
  variantLabel: string | null;
  selectedOptionsSnapshot: OrderItemSelectedOptionSnapshot[];
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  supplierName?: string | null;
};

type UpdateOrderItemInput = {
  orderId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  productSku: string;
  variantLabel: string | null;
  selectedOptionsSnapshot: OrderItemSelectedOptionSnapshot[];
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  supplierName?: string | null;
};

type DeleteOrderItemInput = {
  orderId: string;
  orderItemId: string;
};

async function addOrderItemToOrder(
  input: AddOrderItemToOrderInput,
): Promise<void> {
  const subtotal = calculateOrderItemSubtotal(input.quantity, input.unitPrice);

  const orderItemPayload: Record<string, unknown> = {
    orderId: input.orderId,
    productId: input.productId,
    productNameSnapshot: input.productName,
    productImageUrlSnapshot: input.productImageUrl,
    productSkuSnapshot: input.productSku,
    selectedOptionsSnapshot: JSON.stringify(input.selectedOptionsSnapshot),
    quantity: input.quantity,
    unitPriceSnapshot: input.unitPrice,
    unitCostSnapshot: input.unitCost,
    totalPriceSnapshot: subtotal,
    totalCostSnapshot:
      input.unitCost != null ? input.unitCost * input.quantity : null,
    supplierName: input.supplierName ?? null,
    status: "pending",
    createdAtForSort: new Date().toISOString(),
  };

  const { errors: orderItemErrors } = await client.models.OrderItem.create(
    orderItemPayload as Parameters<typeof client.models.OrderItem.create>[0],
  );

  if (orderItemErrors && orderItemErrors.length > 0) {
    throw new Error(orderItemErrors[0]?.message ?? "新增明細項目失敗");
  }

  // 重新計算訂單總金額
  await recalculateOrderTotal(input.orderId);
}

async function updateOrderItemInOrder(
  input: UpdateOrderItemInput,
): Promise<void> {
  const subtotal = calculateOrderItemSubtotal(input.quantity, input.unitPrice);

  const updatePayload: Record<string, unknown> = {
    id: input.orderItemId,
    productId: input.productId,
    productNameSnapshot: input.productName,
    productImageUrlSnapshot: input.productImageUrl,
    productSkuSnapshot: input.productSku,
    selectedOptionsSnapshot: JSON.stringify(input.selectedOptionsSnapshot),
    quantity: input.quantity,
    unitPriceSnapshot: input.unitPrice,
    unitCostSnapshot: input.unitCost,
    totalPriceSnapshot: subtotal,
    totalCostSnapshot:
      input.unitCost != null ? input.unitCost * input.quantity : null,
    supplierName: input.supplierName ?? null,
  };

  const { errors } = await client.models.OrderItem.update(
    updatePayload as Parameters<typeof client.models.OrderItem.update>[0],
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "更新明細項目失敗");
  }

  // 重新計算訂單總金額
  await recalculateOrderTotal(input.orderId);
}

async function deleteOrderItemFromOrder(
  input: DeleteOrderItemInput,
): Promise<void> {
  const { errors } = await client.models.OrderItem.delete({
    id: input.orderItemId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "刪除明細項目失敗");
  }

  // 重新計算訂單總金額
  await recalculateOrderTotal(input.orderId);
}

/** 重新查詢訂單所有明細並更新訂單總金額 */
async function recalculateOrderTotal(orderId: string): Promise<void> {
  const { data: orderItemsData, errors: queryErrors } =
    await client.models.OrderItem.listOrderItemsByOrderId(
      { orderId },
      { selectionSet: ["id", "quantity", "unitPriceSnapshot"] },
    );

  if (queryErrors && queryErrors.length > 0) {
    throw new Error(queryErrors[0]?.message ?? "查詢明細項目失敗");
  }

  const items = (orderItemsData ?? []).map((li) => ({
    id: String(li.id ?? ""),
    productId: "",
    productName: "",
    productImageUrl: null,
    productSku: "",
    variantLabel: null,
    selectedOptionsSnapshot: [],
    quantity: Number(li.quantity ?? 0),
    unitPrice: Number(li.unitPriceSnapshot ?? 0),
    unitCostSnapshot: null,
    subtotal: 0,
    totalCostSnapshot: null,
    status: "pending" as const,
    purchasedAt: null,
    receivedAt: null,
    shippedAt: null,
    outOfStockAt: null,
    supplierName: null,
    unitCost: null,
  }));

  const newTotal = calculateOrderTotal(items);

  const { errors: updateErrors } = await client.models.Order.update({
    id: orderId,
    subtotalAmount: newTotal,
    totalAmount: newTotal,
  });

  if (updateErrors && updateErrors.length > 0) {
    throw new Error(updateErrors[0]?.message ?? "更新訂單總金額失敗");
  }
}

/** 新增明細項目至既有訂單 */
export function useAddOrderItemToOrder(): UseMutationResult<
  void,
  Error,
  AddOrderItemToOrderInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addOrderItemToOrder,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.productItems() });
    },
  });
}

/** 更新既有訂單的明細項目 */
export function useUpdateOrderItemInOrder(): UseMutationResult<
  void,
  Error,
  UpdateOrderItemInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrderItemInOrder,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.productItems() });
    },
  });
}

/** 刪除既有訂單的明細項目 */
export function useDeleteOrderItemFromOrder(): UseMutationResult<
  void,
  Error,
  DeleteOrderItemInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOrderItemFromOrder,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.productItems() });
    },
  });
}
