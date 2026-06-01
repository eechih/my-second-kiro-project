import { client } from "@/lib/amplify-client";
import type { SortField } from "@/lib/table-utils";
import { sortCustomers } from "@/lib/table-utils";
import { ACTIVE_STATUS, toActiveStatusKey } from "@shared/models";
import type {
  CreateCustomerInput,
  Customer,
  PaginatedResult,
  UpdateCustomerInput,
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

/** 狀態篩選型別 */
export type StatusFilter = "all" | "active" | "inactive";

/** 游標式客戶列表查詢參數 */
export interface CustomerListParams {
  /** 每頁筆數 */
  pageSize: number;
  /** 游標 token（首頁為 undefined） */
  nextToken?: string;
  /** 搜尋關鍵字（模糊比對 name/phone） */
  search?: string;
  /** 啟用狀態篩選（undefined 表示全部） */
  isActive?: boolean;
  /** 排序欄位 */
  sortField?: SortField;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const CUSTOMER_KEYS = {
  all: ["customers"] as const,
  lists: () => [...CUSTOMER_KEYS.all, "list"] as const,
  list: (params: CustomerListParams) =>
    [...CUSTOMER_KEYS.lists(), params] as const,
  details: () => [...CUSTOMER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...CUSTOMER_KEYS.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCustomerFilter({
  search,
  isActive,
}: Pick<CustomerListParams, "search" | "isActive">): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (isActive !== undefined) {
    filter.isActive = { eq: isActive };
  }

  if (search) {
    filter.or = [
      { name: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  return filter;
}

function buildCustomerListParams({
  pageSize,
  nextToken,
  search,
  isActive,
}: CustomerListParams): Record<string, unknown> {
  const filter = buildCustomerFilter({ search, isActive });
  const listParams: Record<string, unknown> = { limit: pageSize };

  if (nextToken) {
    listParams.nextToken = nextToken;
  }

  if (Object.keys(filter).length > 0) {
    listParams.filter = filter;
  }

  return listParams;
}

function applyCustomerUpdate(
  customer: Customer,
  input: UpdateCustomerInput,
): Customer {
  return {
    ...customer,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.address !== undefined && { address: input.address }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  };
}

async function fetchCustomerList(
  params: CustomerListParams,
): Promise<PaginatedResult<string>> {
  const { sortField } = params;
  const {
    data,
    errors,
    nextToken: responseNextToken,
  } = await client.models.Customer.list(buildCustomerListParams(params));

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢客戶列表失敗");
  }

  const items: Customer[] = (data ?? []).map(mapToCustomer);
  const sortedItems = sortField ? sortCustomers(items, sortField) : items;

  return {
    items: sortedItems.map((customer) => customer.id),
    totalCount: sortedItems.length,
    nextToken: responseNextToken ?? undefined,
  };
}

async function fetchCustomer(id: string): Promise<Customer> {
  const { data, errors } = await client.models.Customer.get({ id });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢客戶失敗");
  }

  if (!data) {
    throw new Error("找不到該客戶");
  }

  return mapToCustomer(data);
}

async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const now = new Date().toISOString();
  const { data, errors } = await client.models.Customer.create({
    name: input.name,
    phone: input.phone,
    email: input.email ?? "",
    address: input.address ?? "",
    isActive: true,
    activeStatusKey: ACTIVE_STATUS.active,
    orderCount: 0,
    orderCountForSort: 0,
    lastOrderedAt: null,
    lastOrderedAtForSort: now,
    gsiPartition: "Customer",
    createdAtForSort: now,
  } as Parameters<typeof client.models.Customer.create>[0]);

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "建立客戶失敗");
  }

  if (!data) {
    throw new Error("建立客戶失敗：未回傳資料");
  }

  return mapToCustomer(data);
}

async function updateCustomer(input: UpdateCustomerInput): Promise<Customer> {
  const { data, errors } = await client.models.Customer.update({
    id: input.id,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.address !== undefined && { address: input.address }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
    ...(input.isActive !== undefined && {
      activeStatusKey: toActiveStatusKey(input.isActive),
    }),
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "更新客戶失敗");
  }

  if (!data) {
    throw new Error("更新客戶失敗：未回傳資料");
  }

  return mapToCustomer(data);
}

/** 將 Amplify Data 回傳的原始資料映射為 Customer 型別 */
function mapToCustomer(raw: Record<string, unknown>): Customer {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    isActive: raw.isActive !== false,
    orderCount: Number(raw.orderCount ?? 0),
    lastOrderedAt: raw.lastOrderedAt ? String(raw.lastOrderedAt) : null,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * 客戶列表查詢 hook（游標式分頁）
 *
 * 使用 TanStack Query 搭配 DynamoDB nextToken 實現游標式分頁。
 * 支援搜尋（name/phone 模糊比對）與 isActive 篩選。
 * isActive 為 undefined 時查詢全部狀態。
 *
 * 需求：1.1, 1.5, 1.9
 */
export function useCustomerList(
  params: CustomerListParams,
): UseQueryResult<PaginatedResult<string>> {
  return useQuery({
    queryKey: CUSTOMER_KEYS.list(params),
    queryFn: () => fetchCustomerList(params),
  });
}

/**
 * 單一客戶查詢 hook
 *
 * 需求：1.2, 1.3
 */
export function useCustomer(id: string): UseQueryResult<Customer> {
  return useQuery({
    queryKey: CUSTOMER_KEYS.detail(id),
    queryFn: () => fetchCustomer(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * 建立客戶 mutation hook
 *
 * 需求：1.2
 */
export function useCreateCustomer(): UseMutationResult<
  Customer,
  Error,
  CreateCustomerInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
    },
  });
}

/**
 * 更新客戶 mutation hook
 *
 * 需求：1.3
 */
export function useUpdateCustomer(): UseMutationResult<
  Customer,
  Error,
  UpdateCustomerInput,
  { previousCustomer?: Customer }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCustomer,
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: CUSTOMER_KEYS.detail(input.id),
      });

      const previousCustomer = queryClient.getQueryData<Customer>(
        CUSTOMER_KEYS.detail(input.id),
      );

      if (previousCustomer) {
        queryClient.setQueryData<Customer>(
          CUSTOMER_KEYS.detail(input.id),
          applyCustomerUpdate(previousCustomer, input),
        );
      }

      return { previousCustomer };
    },
    onError: (_error, input, context) => {
      if (context?.previousCustomer) {
        queryClient.setQueryData(
          CUSTOMER_KEYS.detail(input.id),
          context.previousCustomer,
        );
      }
    },
    onSuccess: (updatedCustomer) => {
      queryClient.setQueryData(
        CUSTOMER_KEYS.detail(updatedCustomer.id),
        updatedCustomer,
      );
    },
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: CUSTOMER_KEYS.detail(input.id),
      });
    },
  });
}

export { CUSTOMER_KEYS };
