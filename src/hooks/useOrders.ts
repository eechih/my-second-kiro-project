import { client } from "@/lib/amplify-client";
import {
  calculateTotalPrice,
  calculateTotalCost,
  calculateTotalAmount,
} from "@shared/logic/order-calculations";
import { isValidOrderStatusTransition } from "@shared/logic/order-status";
import {
  normalizeLegacyOrderStatus,
  normalizePaymentStatus,
  type ConfirmShipmentInput,
  type CreateOrderInput,
  type SelectedOptionSnapshot,
  type Order,
  type PaymentStatus,
  type OrderStatus,
  type PaginatedResult,
  type StatusChange,
} from "@shared/models";
import {
  normalizeProductOrderSummary,
  type ProductOrderSummary,
} from "@shared/models/product-order-summary";
import { syncSupplierOrderSummariesByNames } from "./supplierOrderSummarySync";
import { SUPPLIER_RECEIVING_KEYS } from "./useSupplierReceivings";
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
  customerId?: string;
  enabled?: boolean;
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
  status?: OrderStatus;
  statuses?: OrderStatus[];
}

export interface AllProductOrderItemListParams {
  productId: string;
  status?: OrderStatus;
  statuses?: OrderStatus[];
}

export interface SupplierOrderItemListParams {
  supplierName: string;
  pageSize: number;
  nextToken?: string;
  status?: "ORDERED" | "RECEIVED";
}

export interface ProductOrderItemRecord {
  orderId: string;
  orderNumber: string;
  customerName: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  item: Order;
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
  productOrderSummaries: () =>
    [...ORDER_KEYS.all, "product-order-summaries"] as const,
  allProductItems: () => [...ORDER_KEYS.all, "all-product-items"] as const,
  allProductItemList: (params: AllProductOrderItemListParams) =>
    [...ORDER_KEYS.allProductItems(), params] as const,
  supplierItems: () => [...ORDER_KEYS.all, "supplier-items"] as const,
  supplierItemList: (params: SupplierOrderItemListParams) =>
    [...ORDER_KEYS.supplierItems(), params] as const,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORDER_LIST_SELECTION_SET = [
  "id",
  "orderNumber",
  "customerId",
  "customerNameSnapshot",
  "productNameSnapshot",
  "quantity",
  "totalAmount",
  "status",
  "createdAt",
  "createdAtForSort",
] as const;

const ORDER_DETAIL_SELECTION_SET = [
  "id",
  "customerId",
  "orderNumber",
  "customerNameSnapshot",
  "customerPhoneSnapshot",
  "customerEmailSnapshot",
  "shippingAddressSnapshot",
  "productId",
  "productNameSnapshot",
  "productSkuSnapshot",
  "productImageUrlSnapshot",
  "selectedOptionsSnapshot",
  "quantity",
  "unitPriceSnapshot",
  "unitCostSnapshot",
  "totalPriceSnapshot",
  "totalCostSnapshot",
  "subtotalAmount",
  "shippingAmount",
  "discountAmount",
  "totalAmount",
  "status",
  "paymentStatus",
  "supplierName",
  "purchasedAt",
  "receivedAt",
  "shippedAt",
  "outOfStockAt",
  "paidAt",
  "cancelledAt",
  "refundedAt",
  "completedAt",
  "shipmentId",
  "note",
  "statusHistory",
  "isActive",
  "createdAt",
  "updatedAt",
  "createdAtForSort",
] as const;

const PRODUCT_ORDER_SELECTION_SET = [
  "id",
  "orderNumber",
  "customerId",
  "customerNameSnapshot",
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
  "paymentStatus",
  "supplierName",
  "purchasedAt",
  "receivedAt",
  "shippedAt",
  "outOfStockAt",
  "createdAt",
  "updatedAt",
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
  orderIds: string[];
};

type MarkProcurementInput = {
  orderId: string;
};

type CancelProcurementInput = {
  orderIds: string[];
};

type ConfirmShipmentBaseInput = {
  orderId: string;
};

type OrderItemStatusFlag = "ordered" | "received" | "shipped" | "outOfStock";

type SingleOrderItemStatusFlagInput = {
  orderId: string;
  orderItemId?: string; // kept for backward compat, uses orderId
  flag: OrderItemStatusFlag;
  checked: boolean;
  orderIds?: never;
};

type BatchOrderItemStatusFlagInput = {
  orderIds: string[];
  flag: "ordered" | "outOfStock" | "received";
  checked: boolean;
  orderId?: never;
  orderItemId?: never;
};

type UpdateOrderItemStatusFlagInput =
  | SingleOrderItemStatusFlagInput
  | BatchOrderItemStatusFlagInput;

type CachedOrderSnapshot = {
  orderId: string;
  order?: Order;
};

type StatusFlagMutationContext = {
  previousOrders: CachedOrderSnapshot[];
  supplierNames: Array<string | null | undefined>;
};

function isBatchOrderItemStatusFlagInput(
  input: UpdateOrderItemStatusFlagInput,
): input is BatchOrderItemStatusFlagInput {
  return Array.isArray(input.orderIds);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildOrderFilter({
  search,
  customerId,
  status,
}: Pick<OrderListParams, "search" | "customerId" | "status">):
  | Record<string, unknown>
  | undefined {
  const conditions: Record<string, unknown>[] = [];

  if (customerId) {
    conditions.push({ customerId: { eq: customerId } });
  }

  if (status && status !== ("all" as string)) {
    conditions.push({ status: { eq: status } });
  }

  if (search) {
    const trimmed = search.trim();
    if (trimmed) {
      conditions.push({
        or: [
          { orderNumber: { contains: trimmed } },
          { customerNameSnapshot: { contains: trimmed } },
        ],
      });
    }
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return conditions.length === 1 ? conditions[0] : { and: conditions };
}

function buildOrderListParams({
  pageSize,
  nextToken,
  search,
  customerId,
  status,
}: OrderListParams): Record<string, unknown> {
  const filter = buildOrderFilter({ search, customerId, status });
  return {
    filter,
    limit: pageSize,
    ...(nextToken ? { nextToken } : {}),
    selectionSet: ORDER_LIST_SELECTION_SET,
  };
}

async function fetchOrderList(
  params: OrderListParams,
): Promise<PaginatedResult<Order>> {
  const listParams = buildOrderListParams(params);

  const { data, errors, nextToken } = params.customerId
    ? await client.models.Order.listOrdersByCustomer(
        { customerId: params.customerId },
        {
          sortDirection: "DESC",
          ...listParams,
        } as Record<string, unknown>,
      )
    : await client.models.Order.listOrdersByCreatedDate(
        { gsiPartition: "Order" },
        {
          sortDirection: "DESC",
          ...listParams,
        } as Record<string, unknown>,
      );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢訂單列表失敗");
  }

  const items = (data ?? []).map((raw) =>
    mapToOrder(raw as unknown as Record<string, unknown>),
  );

  return {
    items,
    totalCount: items.length,
    nextToken: nextToken ?? undefined,
  };
}

async function fetchCustomerOrderList(
  params: CustomerOrderListParams,
): Promise<PaginatedResult<Order>> {
  const { data, errors, nextToken } =
    await client.models.Order.listOrdersByCustomer(
      { customerId: params.customerId },
      {
        sortDirection: "DESC",
        limit: params.pageSize,
        ...(params.nextToken ? { nextToken: params.nextToken } : {}),
        selectionSet: ORDER_LIST_SELECTION_SET,
      } as Record<string, unknown>,
    );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢客戶訂單失敗");
  }

  const items = (data ?? []).map((raw) =>
    mapToOrder(raw as unknown as Record<string, unknown>),
  );

  return {
    items,
    totalCount: items.length,
    nextToken: nextToken ?? undefined,
  };
}

export async function fetchAllCustomerOrders(
  customerId: string,
): Promise<Order[]> {
  const orders: Order[] = [];
  let nextToken: string | undefined;

  do {
    const {
      data,
      errors,
      nextToken: responseNextToken,
    } = await client.models.Order.listOrdersByCustomer({ customerId }, {
      sortDirection: "DESC",
      limit: 100,
      ...(nextToken ? { nextToken } : {}),
      selectionSet: ORDER_DETAIL_SELECTION_SET,
    } as Record<string, unknown>);

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "查詢客戶訂單失敗");
    }

    for (const raw of data ?? []) {
      orders.push(mapToOrder(raw as unknown as Record<string, unknown>));
    }
    nextToken = responseNextToken ?? undefined;
  } while (nextToken);

  return orders;
}

export async function fetchCustomerOrdersByStatus(
  customerId: string,
  status?: string,
): Promise<Order[]> {
  const orders: Order[] = [];
  let nextToken: string | undefined;

  const customerStatusSortFilter = status
    ? { beginsWith: `${status}#` }
    : undefined;

  do {
    const {
      data,
      errors,
      nextToken: responseNextToken,
    } = await client.models.Order.listOrdersByCustomerStatus(
      {
        customerId,
        ...(customerStatusSortFilter
          ? { customerStatusSort: customerStatusSortFilter }
          : {}),
      },
      {
        sortDirection: "DESC",
        limit: 200,
        ...(nextToken ? { nextToken } : {}),
        selectionSet: ORDER_DETAIL_SELECTION_SET,
      } as Record<string, unknown>,
    );

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "查詢客戶訂單失敗");
    }

    for (const raw of data ?? []) {
      orders.push(mapToOrder(raw as unknown as Record<string, unknown>));
    }
    nextToken = (responseNextToken as string) ?? undefined;
  } while (nextToken);

  return orders;
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
    await client.models.Order.listOrdersByProductId(
      { productId: params.productId },
      {
        sortDirection: "DESC",
        limit: params.pageSize,
        ...(params.nextToken ? { nextToken: params.nextToken } : {}),
        ...(statusFilter ? { filter: statusFilter } : {}),
        selectionSet: PRODUCT_ORDER_SELECTION_SET,
      } as Record<string, unknown>,
    );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢單品採購資料失敗");
  }

  const items = (data ?? []).map((raw: Record<string, unknown>) => {
    const order = mapToOrder(raw as unknown as Record<string, unknown>);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerNameSnapshot,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      item: order,
    } satisfies ProductOrderItemRecord;
  });

  return {
    items,
    totalCount: items.length,
    nextToken: nextToken ?? undefined,
  };
}

export async function fetchAllProductOrderItems(
  params: AllProductOrderItemListParams,
): Promise<ProductOrderItemRecord[]> {
  const items: ProductOrderItemRecord[] = [];
  let nextToken: string | undefined;

  do {
    const page = await fetchProductOrderItemList({
      productId: params.productId,
      pageSize: 100,
      nextToken,
      status: params.status,
      statuses: params.statuses,
    });

    items.push(...page.items);
    nextToken = page.nextToken;
  } while (nextToken);

  return items;
}

async function fetchProductOrderSummaries(): Promise<ProductOrderSummary[]> {
  const { data, errors } = await client.queries.getProductOrderSummaries({});

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢商品訂單摘要失敗");
  }

  const parsed = parseProductOrderSummaries(data);
  if (!parsed) {
    throw new Error("查詢商品訂單摘要失敗：回傳格式錯誤");
  }

  return parsed;
}

function parseProductOrderSummaries(
  result: unknown,
): ProductOrderSummary[] | null {
  const payload = parseJsonPayload(result);
  if (payload == null) {
    return [];
  }

  const items = extractSummaryItems(payload);
  if (!items) {
    return null;
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const normalized = normalizeProductOrderSummary(
      item as Record<string, unknown>,
    );

    return normalized ? [normalized] : [];
  });
}

function parseJsonPayload(result: unknown): unknown {
  let current = result;

  for (let i = 0; i < 3; i += 1) {
    if (typeof current === "string") {
      try {
        current = JSON.parse(current) as unknown;
      } catch {
        return null;
      }
      continue;
    }

    return current;
  }

  return current;
}

function extractSummaryItems(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record["items"])) {
    return record["items"];
  }

  if (Array.isArray(record["data"])) {
    return record["data"];
  }

  if (
    typeof record["productId"] === "string" ||
    typeof record["id"] === "string"
  ) {
    return [record];
  }

  return null;
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
        or: [{ status: { eq: "ORDERED" } }, { status: { eq: "RECEIVED" } }],
      };

  return {
    and: [{ supplierName: { eq: trimmedSupplierName } }, statusFilter],
  };
}

async function fetchSupplierOrderItemList(
  params: SupplierOrderItemListParams,
): Promise<PaginatedResult<ProductOrderItemRecord>> {
  const { data, errors, nextToken } = await client.models.Order.list({
    filter: buildSupplierOrderItemFilter(params),
    limit: params.pageSize,
    ...(params.nextToken ? { nextToken: params.nextToken } : {}),
    selectionSet: PRODUCT_ORDER_SELECTION_SET,
  } as Record<string, unknown>);

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢供應商入庫資料失敗");
  }

  const items = (data ?? [])
    .map((raw: Record<string, unknown>) => {
      const order = mapToOrder(raw as unknown as Record<string, unknown>);
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerNameSnapshot,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        item: order,
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

  return mapToOrder(data as unknown as Record<string, unknown>);
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

  const selectedOptionsSnapshot = parseSelectedOptionsSnapshot(
    raw.selectedOptionsSnapshot,
  );

  return {
    id: String(raw.id ?? ""),
    orderNumber: String(raw.orderNumber ?? ""),
    customerId: String(raw.customerId ?? ""),
    customerNameSnapshot: String(raw.customerNameSnapshot ?? ""),
    customerPhoneSnapshot: raw.customerPhoneSnapshot
      ? String(raw.customerPhoneSnapshot)
      : null,
    customerEmailSnapshot: raw.customerEmailSnapshot
      ? String(raw.customerEmailSnapshot)
      : null,
    shippingAddressSnapshot: raw.shippingAddressSnapshot
      ? String(raw.shippingAddressSnapshot)
      : null,
    productId: String(raw.productId ?? ""),
    productNameSnapshot: String(raw.productNameSnapshot ?? ""),
    productSkuSnapshot: String(raw.productSkuSnapshot ?? ""),
    productImageUrlSnapshot: raw.productImageUrlSnapshot
      ? String(raw.productImageUrlSnapshot)
      : null,
    selectedOptionsSnapshot,
    quantity: Number(raw.quantity ?? 0),
    unitPriceSnapshot: Number(raw.unitPriceSnapshot ?? 0),
    unitCostSnapshot:
      raw.unitCostSnapshot != null ? Number(raw.unitCostSnapshot) : null,
    totalPriceSnapshot: Number(raw.totalPriceSnapshot ?? 0),
    totalCostSnapshot:
      raw.totalCostSnapshot != null ? Number(raw.totalCostSnapshot) : null,
    subtotalAmount: Number(raw.subtotalAmount ?? 0),
    shippingAmount: Number(raw.shippingAmount ?? 0),
    discountAmount: Number(raw.discountAmount ?? 0),
    totalAmount: Number(raw.totalAmount ?? 0),
    status: normalizeLegacyOrderStatus({
      status: raw.status,
      fulfillmentStatus: raw.fulfillmentStatus,
      cancelledAt: raw.cancelledAt,
    }),
    paymentStatus: normalizePaymentStatus(raw.paymentStatus),
    supplierName: raw.supplierName ? String(raw.supplierName) : null,
    purchasedAt: raw.purchasedAt ? String(raw.purchasedAt) : null,
    receivedAt: raw.receivedAt ? String(raw.receivedAt) : null,
    shippedAt: raw.shippedAt ? String(raw.shippedAt) : null,
    outOfStockAt: raw.outOfStockAt ? String(raw.outOfStockAt) : null,
    paidAt: raw.paidAt ? String(raw.paidAt) : null,
    cancelledAt: raw.cancelledAt ? String(raw.cancelledAt) : null,
    refundedAt: raw.refundedAt ? String(raw.refundedAt) : null,
    completedAt: raw.completedAt ? String(raw.completedAt) : null,
    note: raw.note ? String(raw.note) : null,
    statusHistory,
    shipmentId: raw.shipmentId ? String(raw.shipmentId) : null,
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function parseSelectedOptionsSnapshot(raw: unknown): SelectedOptionSnapshot[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;

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
      .filter(
        (item) => item.optionName.length > 0 && item.valueName.length > 0,
      );
  } catch {
    return [];
  }
}

async function createOrder(input: CreateOrderInput): Promise<Order> {
  const quantity = input.quantity;
  const unitPrice = input.unitPriceSnapshot;
  const unitCost = input.unitCostSnapshot ?? null;

  const totalPriceSnapshot = calculateTotalPrice(quantity, unitPrice);
  const totalCostSnapshot = calculateTotalCost(quantity, unitCost);
  const shippingAmount = input.shippingAmount ?? 0;
  const discountAmount = input.discountAmount ?? 0;
  const subtotalAmount = totalPriceSnapshot;
  const totalAmount = calculateTotalAmount(
    subtotalAmount,
    shippingAmount,
    discountAmount,
  );

  const orderNumber = generateOrderNumber();
  const now = new Date().toISOString();

  const { data: orderData, errors: orderErrors } =
    await client.models.Order.create({
      customerId: input.customerId,
      orderNumber,
      customerNameSnapshot: input.customerNameSnapshot,
      customerPhoneSnapshot: input.customerPhoneSnapshot ?? null,
      customerEmailSnapshot: input.customerEmailSnapshot ?? null,
      shippingAddressSnapshot: input.shippingAddressSnapshot ?? null,
      productId: input.productId,
      productNameSnapshot: input.productNameSnapshot,
      productSkuSnapshot: input.productSkuSnapshot,
      productImageUrlSnapshot: input.productImageUrlSnapshot ?? null,
      selectedOptionsSnapshot: JSON.stringify(
        input.selectedOptionsSnapshot ?? [],
      ),
      quantity,
      unitPriceSnapshot: unitPrice,
      unitCostSnapshot: unitCost,
      totalPriceSnapshot,
      totalCostSnapshot,
      subtotalAmount,
      shippingAmount,
      discountAmount,
      totalAmount,
      status: "PENDING",
      paymentStatus: "UNPAID",
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

  // 更新客戶訂單次數
  const { data: customerData, errors: customerErrors } =
    await client.models.Customer.get({ id: input.customerId });

  if (customerErrors && customerErrors.length > 0) {
    throw new Error(customerErrors[0]?.message ?? "更新客戶下單時間失敗");
  }

  if (customerData) {
    const nextOrderCount = Number(customerData.orderCount ?? 0) + 1;
    const { errors: customerUpdateErrors } =
      await client.models.Customer.update({
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

  return mapToOrder(orderData as unknown as Record<string, unknown>);
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

  let paymentStatus: PaymentStatus = currentPaymentStatus;
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

  return mapToOrder(data as unknown as Record<string, unknown>);
}

async function confirmReceived(input: ConfirmReceivedInput): Promise<Order> {
  const resultOrderId = input.orderIds[0];
  if (!resultOrderId) {
    throw new Error("請指定要確認入庫的訂單");
  }

  const { data, errors } = await client.mutations.confirmReceived({
    orderIds: input.orderIds,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "入庫確認失敗");
  }

  assertCustomMutationSuccess(data, "入庫確認失敗");

  return fetchOrder(resultOrderId);
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

async function cancelReceived(input: ConfirmReceivedInput): Promise<Order> {
  const resultOrderId = input.orderIds[0];
  if (!resultOrderId) {
    throw new Error("請指定要取消入庫的訂單");
  }

  const { data: result, errors } = await client.mutations.cancelReceived({
    orderIds: input.orderIds,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消到貨失敗");
  }

  assertCustomMutationSuccess(result, "取消到貨失敗");

  return fetchOrder(resultOrderId);
}

async function confirmOutOfStock(input: {
  orderIds: string[];
}): Promise<Order> {
  const resultOrderId = input.orderIds[0];
  if (!resultOrderId) {
    throw new Error("請指定要確認缺貨的訂單");
  }

  const { data: result, errors } = await client.mutations.confirmOutOfStock({
    orderIds: input.orderIds,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "確認缺貨失敗");
  }

  assertCustomMutationSuccess(result, "確認缺貨失敗");

  return fetchOrder(resultOrderId);
}

async function cancelOutOfStock(input: { orderIds: string[] }): Promise<Order> {
  const resultOrderId = input.orderIds[0];
  if (!resultOrderId) {
    throw new Error("請指定要取消缺貨的訂單");
  }

  const { data: result, errors } = await client.mutations.cancelOutOfStock({
    orderIds: input.orderIds,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消缺貨失敗");
  }

  assertCustomMutationSuccess(result, "取消缺貨失敗");

  return fetchOrder(resultOrderId);
}

async function confirmPurchase(input: { orderIds: string[] }): Promise<Order> {
  const resultOrderId = input.orderIds[0];
  if (!resultOrderId) {
    throw new Error("請指定要確認採購的訂單");
  }

  const { data: result, errors } = await client.mutations.confirmPurchase({
    orderIds: input.orderIds,
    supplierName: "",
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "採購下單失敗");
  }

  assertCustomMutationSuccess(result, "採購下單失敗");

  return fetchOrder(resultOrderId);
}

async function markProcurement(input: MarkProcurementInput): Promise<Order> {
  return confirmPurchase({ orderIds: [input.orderId] });
}

async function cancelProcurement(
  input: CancelProcurementInput,
): Promise<Order> {
  const resultOrderId = input.orderIds[0];
  if (!resultOrderId) {
    throw new Error("請指定要取消採購的訂單");
  }

  const { data: result, errors } = await client.mutations.cancelPurchase({
    orderIds: input.orderIds,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消採購失敗");
  }

  assertCustomMutationSuccess(result, "取消採購失敗");

  return fetchOrder(resultOrderId);
}

async function updateOrderItemStatusFlag(
  input: UpdateOrderItemStatusFlagInput,
): Promise<Order> {
  if (isBatchOrderItemStatusFlagInput(input)) {
    if (input.flag === "ordered") {
      return input.checked
        ? confirmPurchase({ orderIds: input.orderIds })
        : cancelProcurement({ orderIds: input.orderIds });
    }

    if (input.flag === "received") {
      return input.checked
        ? confirmReceived({ orderIds: input.orderIds })
        : cancelReceived({ orderIds: input.orderIds });
    }

    return input.checked
      ? confirmOutOfStock({ orderIds: input.orderIds })
      : cancelOutOfStock({ orderIds: input.orderIds });
  }

  if (input.flag === "ordered") {
    return input.checked
      ? confirmPurchase({ orderIds: [input.orderId] })
      : cancelProcurement({ orderIds: [input.orderId] });
  }

  if (input.flag === "received") {
    return input.checked
      ? confirmReceived({ orderIds: [input.orderId] })
      : cancelReceived({ orderIds: [input.orderId] });
  }

  if (input.flag === "shipped") {
    return input.checked
      ? confirmShipmentDirect({ orderId: input.orderId })
      : cancelShipmentDirect({ orderId: input.orderId });
  }

  if (input.flag === "outOfStock") {
    return input.checked
      ? confirmOutOfStock({ orderIds: [input.orderId] })
      : cancelOutOfStock({ orderIds: [input.orderId] });
  }

  throw new Error("不支援的明細狀態操作");
}

async function confirmShipmentDirect(
  input: ConfirmShipmentBaseInput,
): Promise<Order> {
  const { data, errors } = await client.mutations.confirmShipment({
    orderId: input.orderId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "出貨操作失敗");
  }

  assertCustomMutationSuccess(data, "出貨操作失敗");

  return fetchOrder(input.orderId);
}

async function cancelShipmentDirect(
  input: ConfirmShipmentBaseInput,
): Promise<Order> {
  const { data: result, errors } = await client.mutations.cancelShipment({
    orderId: input.orderId,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "取消出貨失敗");
  }

  assertCustomMutationSuccess(result, "取消出貨失敗");

  return fetchOrder(input.orderId);
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * 訂單列表查詢 hook
 *
 * 支援游標式分頁與搜尋（依訂單編號或客戶名稱）。
 */
export function useOrderList(
  params: OrderListParams,
): UseQueryResult<PaginatedResult<Order>> {
  return useQuery({
    queryKey: ORDER_KEYS.list(params),
    queryFn: () => fetchOrderList(params),
    enabled: params.enabled !== false,
  });
}

export function useCustomerOrderList(
  params: CustomerOrderListParams,
): UseQueryResult<PaginatedResult<Order>> {
  return useQuery({
    queryKey: ORDER_KEYS.customerList(params),
    queryFn: () => fetchCustomerOrderList(params),
  });
}

function invalidateProductOrderSummaryQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  void queryClient.invalidateQueries({
    queryKey: ORDER_KEYS.productOrderSummaries(),
  });
  void queryClient.invalidateQueries({ queryKey: ["product-purchases"] });
}

function invalidateProductOrderItemQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  void queryClient.invalidateQueries({
    queryKey: ORDER_KEYS.productItems(),
  });
  void queryClient.invalidateQueries({
    queryKey: ORDER_KEYS.allProductItems(),
  });
}

function invalidateSupplierReceivingQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  void queryClient.invalidateQueries({
    queryKey: SUPPLIER_RECEIVING_KEYS.all,
  });
  void queryClient.invalidateQueries({
    queryKey: ORDER_KEYS.supplierItems(),
  });
}

function orderIdsFromStatusFlagInput(
  input: UpdateOrderItemStatusFlagInput,
): string[] {
  const orderIds = isBatchOrderItemStatusFlagInput(input)
    ? input.orderIds
    : [input.orderId];

  return Array.from(
    new Set(orderIds.map((orderId) => orderId.trim()).filter(Boolean)),
  );
}

async function snapshotOrderDetails(
  queryClient: ReturnType<typeof useQueryClient>,
  orderIds: readonly string[],
): Promise<CachedOrderSnapshot[]> {
  await Promise.all(
    orderIds.map((orderId) =>
      queryClient.cancelQueries({ queryKey: ORDER_KEYS.detail(orderId) }),
    ),
  );

  return orderIds.map((orderId) => ({
    orderId,
    order: queryClient.getQueryData<Order>(ORDER_KEYS.detail(orderId)),
  }));
}

function restoreOrderSnapshots(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: readonly CachedOrderSnapshot[],
): void {
  for (const snapshot of snapshots) {
    if (!snapshot.order) {
      continue;
    }

    queryClient.setQueryData(
      ORDER_KEYS.detail(snapshot.orderId),
      snapshot.order,
    );
  }
}

function supplierNamesFromSnapshots(
  snapshots: readonly CachedOrderSnapshot[],
): Array<string | null | undefined> {
  return snapshots.map(({ order }) => order?.supplierName ?? null);
}

function invalidateOrderDetailQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  orderIds: readonly string[],
): void {
  for (const orderId of orderIds) {
    void queryClient.invalidateQueries({
      queryKey: ORDER_KEYS.detail(orderId),
    });
  }
}

export function useProductOrderItemList(
  params: ProductOrderItemListParams,
): UseQueryResult<PaginatedResult<ProductOrderItemRecord>> {
  return useQuery({
    queryKey: ORDER_KEYS.productItemList(params),
    queryFn: () => fetchProductOrderItemList(params),
  });
}

export function useProductOrderSummaries(): UseQueryResult<
  ProductOrderSummary[]
> {
  return useQuery({
    queryKey: ORDER_KEYS.productOrderSummaries(),
    queryFn: fetchProductOrderSummaries,
    staleTime: 60_000,
  });
}

export function useAllProductOrderItems(
  params: AllProductOrderItemListParams,
): UseQueryResult<ProductOrderItemRecord[]> {
  return useQuery({
    queryKey: ORDER_KEYS.allProductItemList(params),
    queryFn: () => fetchAllProductOrderItems(params),
  });
}

export function useSupplierOrderItemList(
  params: SupplierOrderItemListParams,
): UseQueryResult<PaginatedResult<ProductOrderItemRecord>> {
  return useQuery({
    queryKey: ORDER_KEYS.supplierItemList(params),
    queryFn: () => fetchSupplierOrderItemList(params),
  });
}

export interface AllSupplierOrderItemListParams {
  supplierName: string;
  status?: "ORDERED" | "RECEIVED";
}

async function fetchAllSupplierOrderItems(
  params: AllSupplierOrderItemListParams,
): Promise<ProductOrderItemRecord[]> {
  const items: ProductOrderItemRecord[] = [];
  let nextToken: string | undefined;

  const supplierStatusSortFilter = params.status
    ? { beginsWith: `${params.status}#` }
    : undefined;

  do {
    const {
      data,
      errors,
      nextToken: nt,
    } = await client.models.Order.listOrdersBySupplierStatus(
      {
        supplierName: params.supplierName.trim(),
        ...(supplierStatusSortFilter
          ? { supplierStatusSort: supplierStatusSortFilter }
          : {}),
      },
      {
        sortDirection: "DESC",
        limit: 200,
        ...(nextToken ? { nextToken } : {}),
        selectionSet: PRODUCT_ORDER_SELECTION_SET,
      } as Record<string, unknown>,
    );

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "查詢供應商入庫資料失敗");
    }

    for (const raw of data ?? []) {
      const order = mapToOrder(raw as unknown as Record<string, unknown>);
      items.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerNameSnapshot,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        item: order,
      });
    }

    nextToken = (nt as string) ?? undefined;
  } while (nextToken);

  return items;
}

export function useAllSupplierOrderItems(
  params: AllSupplierOrderItemListParams,
): UseQueryResult<ProductOrderItemRecord[]> {
  return useQuery({
    queryKey: [...ORDER_KEYS.supplierItems(), "all", params],
    queryFn: () => fetchAllSupplierOrderItems(params),
    enabled: !!params.supplierName,
  });
}

export function useOrder(id: string): UseQueryResult<Order> {
  return useQuery({
    queryKey: ORDER_KEYS.detail(id),
    queryFn: () => fetchOrder(id),
    enabled: !!id,
  });
}

export function usePrefetchOrder(): (orderId: string) => void {
  const queryClient = useQueryClient();

  return (orderId: string) => {
    void queryClient.prefetchQuery({
      queryKey: ORDER_KEYS.detail(orderId),
      queryFn: () => fetchOrder(orderId),
    });
  };
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * 建立訂單 mutation hook
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
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.customerLists(),
      });
      invalidateProductOrderSummaryQueries(queryClient);
    },
  });
}

/**
 * 更新訂單狀態 mutation hook
 */
export function useUpdateOrderStatus(): UseMutationResult<
  Order,
  Error,
  UpdateOrderStatusInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrderStatus,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      invalidateProductOrderSummaryQueries(queryClient);
    },
  });
}

/**
 * 入庫確認 mutation hook
 *
 * 呼叫 confirmReceived custom mutation。
 * 實作樂觀更新：立即更新快取中的 Order 狀態為「已收到」。
 */
export function useConfirmReceived(): UseMutationResult<
  Order,
  Error,
  ConfirmReceivedInput,
  { previousOrder?: Order; previousSupplierName?: string | null }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: confirmReceived,
    onMutate: async (input) => {
      const resultOrderId = input.orderIds[0];
      if (!resultOrderId)
        return { previousOrder: undefined, previousSupplierName: null };

      const orderKey = ORDER_KEYS.detail(resultOrderId);
      await queryClient.cancelQueries({ queryKey: orderKey });

      const previousOrder = queryClient.getQueryData<Order>(orderKey);

      if (previousOrder) {
        queryClient.setQueryData(orderKey, {
          ...previousOrder,
          status: "RECEIVED" as const,
          receivedAt: new Date().toISOString(),
        });
      }

      return {
        previousOrder,
        previousSupplierName: previousOrder?.supplierName ?? null,
      };
    },
    onError: (_err, input, context) => {
      if (context?.previousOrder) {
        const resultOrderId = input.orderIds[0];
        if (resultOrderId) {
          const orderKey = ORDER_KEYS.detail(resultOrderId);
          queryClient.setQueryData(orderKey, context.previousOrder);
        }
      }
    },
    onSuccess: async (order, _input, context) => {
      await syncSupplierOrderSummariesByNames([
        context?.previousSupplierName,
        order.supplierName,
      ]);
    },
    onSettled: (_, __, input) => {
      for (const orderId of input.orderIds) {
        void queryClient.invalidateQueries({
          queryKey: ORDER_KEYS.detail(orderId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      invalidateSupplierReceivingQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/**
 * 採購下單 mutation hook
 */
export function useMarkProcurement(): UseMutationResult<
  Order,
  Error,
  MarkProcurementInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markProcurement,
    onSuccess: async (order, input) => {
      await syncSupplierOrderSummariesByNames([order.supplierName]);
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      invalidateProductOrderSummaryQueries(queryClient);
      invalidateSupplierReceivingQueries(queryClient);
    },
  });
}

/**
 * 採購取消 mutation hook
 */
export function useCancelProcurement(): UseMutationResult<
  Order,
  Error,
  CancelProcurementInput,
  { previousSupplierName?: string | null }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelProcurement,
    onMutate: (input) => {
      const resultOrderId = input.orderIds[0];
      const previousOrder = resultOrderId
        ? queryClient.getQueryData<Order>(ORDER_KEYS.detail(resultOrderId))
        : undefined;

      return {
        previousSupplierName: previousOrder?.supplierName ?? null,
      };
    },
    onSuccess: async (_order, input, context) => {
      await syncSupplierOrderSummariesByNames([context?.previousSupplierName]);
      for (const orderId of input.orderIds) {
        void queryClient.invalidateQueries({
          queryKey: ORDER_KEYS.detail(orderId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      invalidateProductOrderSummaryQueries(queryClient);
      invalidateSupplierReceivingQueries(queryClient);
    },
  });
}

/**
 * 更新訂單狀態旗標 mutation hook
 *
 * 用於訂單列表內的快速 checkbox 操作。
 */
export function useUpdateOrderItemStatusFlag(): UseMutationResult<
  Order,
  Error,
  UpdateOrderItemStatusFlagInput,
  StatusFlagMutationContext
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrderItemStatusFlag,
    onMutate: async (input) => {
      const orderIds = orderIdsFromStatusFlagInput(input);
      const previousOrders = await snapshotOrderDetails(queryClient, orderIds);

      return {
        previousOrders,
        supplierNames: supplierNamesFromSnapshots(previousOrders),
      };
    },
    onError: (_error, _input, context) => {
      if (context) {
        restoreOrderSnapshots(queryClient, context.previousOrders);
      }
    },
    onSuccess: async (order, _input, context) => {
      await syncSupplierOrderSummariesByNames([
        ...(context?.supplierNames ?? []),
        order.supplierName,
      ]);
    },
    onSettled: (_, __, input) => {
      invalidateOrderDetailQueries(
        queryClient,
        orderIdsFromStatusFlagInput(input),
      );
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      invalidateProductOrderItemQueries(queryClient);
      invalidateProductOrderSummaryQueries(queryClient);
      invalidateSupplierReceivingQueries(queryClient);
      if (input.flag === "received" || input.flag === "shipped") {
        void queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    },
  });
}

/**
 * 出貨操作 mutation hook
 *
 * 呼叫 confirmShipment custom mutation。
 */
export function useConfirmShipment(): UseMutationResult<
  Order,
  Error,
  ConfirmShipmentInput & { orderId: string },
  { previousOrder?: Order; previousSupplierName?: string | null }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => confirmShipmentDirect({ orderId: input.orderId }),
    onMutate: async (input) => {
      const orderKey = ORDER_KEYS.detail(input.orderId);
      await queryClient.cancelQueries({ queryKey: orderKey });

      const previousOrder = queryClient.getQueryData<Order>(orderKey);

      if (previousOrder) {
        queryClient.setQueryData(orderKey, {
          ...previousOrder,
          status: "SHIPPED" as const,
          shippedAt: new Date().toISOString(),
        });
      }

      return {
        previousOrder,
        previousSupplierName: previousOrder?.supplierName ?? null,
      };
    },
    onError: (_err, input, context) => {
      if (context?.previousOrder) {
        const orderKey = ORDER_KEYS.detail(input.orderId);
        queryClient.setQueryData(orderKey, context.previousOrder);
      }
    },
    onSuccess: async (order, _input, context) => {
      await syncSupplierOrderSummariesByNames([
        context?.previousSupplierName,
        order.supplierName,
      ]);
    },
    onSettled: (_, __, input) => {
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      invalidateProductOrderSummaryQueries(queryClient);
      invalidateSupplierReceivingQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Create Shipment with Orders
// ---------------------------------------------------------------------------

export interface CreateShipmentWithOrdersInput {
  recipientName: string;
  recipientPhone?: string;
  recipientAddress?: string;
  shippingMethod?: string;
  trackingNumber?: string;
  actualShippingCost?: number;
  note?: string;
  orderIds: string[];
}

export function useCreateShipmentWithOrders(): UseMutationResult<
  unknown,
  Error,
  CreateShipmentWithOrdersInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShipmentWithOrdersInput) => {
      const { data: result, errors } =
        await client.mutations.createShipmentWithOrders({
          recipientName: input.recipientName,
          recipientPhone: input.recipientPhone ?? null,
          recipientAddress: input.recipientAddress ?? null,
          shippingMethod: input.shippingMethod ?? null,
          trackingNumber: input.trackingNumber ?? null,
          actualShippingCost: input.actualShippingCost ?? null,
          note: input.note ?? null,
          orderIds: input.orderIds,
        });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "建立出貨單失敗");
      }

      assertCustomMutationSuccess(result, "建立出貨單失敗");
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.details() });
      invalidateSupplierReceivingQueries(queryClient);
    },
  });
}

// ---------------------------------------------------------------------------
// Split Order Hook (deprecated — feature removed)
// ---------------------------------------------------------------------------

/**
 * @deprecated 訂單分拆功能已移除
 */
export function useSplitOrder(): UseMutationResult<
  Order[],
  Error,
  { orderId: string; allocations: unknown[] }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_input: {
      orderId: string;
      allocations: unknown[];
    }): Promise<Order[]> => {
      throw new Error("訂單分拆功能已停用");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.details() });
    },
  });
}

export { ORDER_KEYS };
export type { ProductOrderSummary };

// ---------------------------------------------------------------------------
// Order Update Hooks (flat model — no separate OrderItem CRUD)
// ---------------------------------------------------------------------------

type AddOrderItemToOrderInput = {
  orderId: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  productSku: string;
  variantLabel: string | null;
  selectedOptionsSnapshot: SelectedOptionSnapshot[];
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
  selectedOptionsSnapshot: SelectedOptionSnapshot[];
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  supplierName?: string | null;
};

type DeleteOrderItemInput = {
  orderId: string;
  orderItemId: string;
};

/**
 * 在扁平化模型中，「新增明細」等同於建立新的 Order。
 * 此 hook 保留舊 API 簽名供向下相容，內部以 Order.create 實作。
 */
async function addOrderItemToOrder(
  input: AddOrderItemToOrderInput,
): Promise<void> {
  const totalPriceSnapshot = calculateTotalPrice(
    input.quantity,
    input.unitPrice,
  );
  const totalCostSnapshot = calculateTotalCost(input.quantity, input.unitCost);
  const subtotalAmount = totalPriceSnapshot;
  const totalAmount = calculateTotalAmount(subtotalAmount, 0, 0);

  // 查詢原訂單以取得客戶資訊
  const sourceOrder = await fetchOrder(input.orderId);
  const orderNumber = generateOrderNumber();
  const now = new Date().toISOString();

  const { errors } = await client.models.Order.create({
    customerId: sourceOrder.customerId,
    orderNumber,
    customerNameSnapshot: sourceOrder.customerNameSnapshot,
    customerPhoneSnapshot: sourceOrder.customerPhoneSnapshot,
    customerEmailSnapshot: sourceOrder.customerEmailSnapshot,
    shippingAddressSnapshot: sourceOrder.shippingAddressSnapshot,
    productId: input.productId,
    productNameSnapshot: input.productName,
    productSkuSnapshot: input.productSku,
    productImageUrlSnapshot: input.productImageUrl,
    selectedOptionsSnapshot: JSON.stringify(input.selectedOptionsSnapshot),
    quantity: input.quantity,
    unitPriceSnapshot: input.unitPrice,
    unitCostSnapshot: input.unitCost,
    totalPriceSnapshot,
    totalCostSnapshot,
    subtotalAmount,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount,
    supplierName: input.supplierName ?? null,
    status: "PENDING",
    paymentStatus: "UNPAID",
    statusHistory: JSON.stringify([]),
    isActive: true,
    gsiPartition: "Order",
    createdAtForSort: now,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "新增訂單失敗");
  }
}

/**
 * 更新訂單商品資訊
 */
async function updateOrderItemInOrder(
  input: UpdateOrderItemInput,
): Promise<void> {
  const totalPriceSnapshot = calculateTotalPrice(
    input.quantity,
    input.unitPrice,
  );
  const totalCostSnapshot = calculateTotalCost(input.quantity, input.unitCost);
  const subtotalAmount = totalPriceSnapshot;
  const totalAmount = calculateTotalAmount(subtotalAmount, 0, 0);

  const { errors } = await client.models.Order.update({
    id: input.orderId,
    productId: input.productId,
    productNameSnapshot: input.productName,
    productImageUrlSnapshot: input.productImageUrl,
    productSkuSnapshot: input.productSku,
    selectedOptionsSnapshot: JSON.stringify(input.selectedOptionsSnapshot),
    quantity: input.quantity,
    unitPriceSnapshot: input.unitPrice,
    unitCostSnapshot: input.unitCost,
    totalPriceSnapshot,
    totalCostSnapshot,
    subtotalAmount,
    totalAmount,
    supplierName: input.supplierName ?? null,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "更新訂單失敗");
  }
}

/**
 * 刪除訂單（軟刪除）
 */
async function deleteOrderItemFromOrder(
  input: DeleteOrderItemInput,
): Promise<void> {
  const now = new Date().toISOString();
  const { errors } = await client.models.Order.update({
    id: input.orderId,
    isActive: false,
    deletedAt: now,
    status: "CANCELLED",
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "刪除訂單失敗");
  }
}

/** 新增明細項目至既有訂單（向下相容） */
export function useAddOrderItemToOrder(): UseMutationResult<
  void,
  Error,
  AddOrderItemToOrderInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addOrderItemToOrder,
    onSuccess: async (_, input) => {
      await syncSupplierOrderSummariesByNames([input.supplierName]);
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      invalidateProductOrderItemQueries(queryClient);
      invalidateProductOrderSummaryQueries(queryClient);
      invalidateSupplierReceivingQueries(queryClient);
    },
  });
}

/** 更新既有訂單的商品資訊 */
export function useUpdateOrderItemInOrder(): UseMutationResult<
  void,
  Error,
  UpdateOrderItemInput,
  { previousSupplierName?: string | null }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrderItemInOrder,
    onMutate: (input) => {
      const previousOrder = queryClient.getQueryData<Order>(
        ORDER_KEYS.detail(input.orderId),
      );

      return {
        previousSupplierName: previousOrder?.supplierName ?? null,
      };
    },
    onSuccess: async (_, input, context) => {
      await syncSupplierOrderSummariesByNames([
        context?.previousSupplierName,
        input.supplierName,
      ]);
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      invalidateProductOrderItemQueries(queryClient);
      invalidateProductOrderSummaryQueries(queryClient);
      invalidateSupplierReceivingQueries(queryClient);
    },
  });
}

/** 刪除既有訂單 */
export function useDeleteOrderItemFromOrder(): UseMutationResult<
  void,
  Error,
  DeleteOrderItemInput,
  { previousSupplierName?: string | null }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOrderItemFromOrder,
    onMutate: (input) => {
      const previousOrder = queryClient.getQueryData<Order>(
        ORDER_KEYS.detail(input.orderId),
      );

      return {
        previousSupplierName: previousOrder?.supplierName ?? null,
      };
    },
    onSuccess: async (_, input, context) => {
      await syncSupplierOrderSummariesByNames([context?.previousSupplierName]);
      void queryClient.invalidateQueries({
        queryKey: ORDER_KEYS.detail(input.orderId),
      });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      invalidateProductOrderItemQueries(queryClient);
      invalidateProductOrderSummaryQueries(queryClient);
      invalidateSupplierReceivingQueries(queryClient);
    },
  });
}
