import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { client } from "@/lib/amplify-client";
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  PaginatedResult,
} from "@shared/models";
import type { SortField } from "@/lib/table-utils";
import { sortCustomers } from "@/lib/table-utils";

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
  /** 搜尋關鍵字（模糊比對 name/contactPerson/phone） */
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
  list: (params: CustomerListParams) => [...CUSTOMER_KEYS.lists(), params] as const,
  details: () => [...CUSTOMER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...CUSTOMER_KEYS.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * 客戶列表查詢 hook（游標式分頁）
 *
 * 使用 TanStack Query 搭配 DynamoDB nextToken 實現游標式分頁。
 * 支援搜尋（name/contactPerson/phone 模糊比對）與 isActive 篩選。
 * isActive 為 undefined 時查詢全部狀態。
 *
 * 需求：1.1, 1.5, 1.9
 */
export function useCustomerList(
  params: CustomerListParams,
): UseQueryResult<PaginatedResult<Customer>> {
  const { pageSize, nextToken, search, isActive, sortField } = params;

  return useQuery({
    queryKey: CUSTOMER_KEYS.list({
      pageSize,
      nextToken,
      search,
      isActive,
      sortField,
    }),
    queryFn: async (): Promise<PaginatedResult<Customer>> => {
      const filter: Record<string, unknown> = {};

      // 狀態篩選
      if (isActive !== undefined) {
        filter.isActive = { eq: isActive };
      }

      // 搜尋篩選（name/contactPerson/phone 模糊比對）
      if (search) {
        filter.or = [
          { name: { contains: search } },
          { contactPerson: { contains: search } },
          { phone: { contains: search } },
        ];
      }

      const listParams: Record<string, unknown> = { limit: pageSize };

      if (nextToken) {
        listParams.nextToken = nextToken;
      }

      if (Object.keys(filter).length > 0) {
        listParams.filter = filter;
      }

      const {
        data,
        errors,
        nextToken: responseNextToken,
      } = await client.models.Customer.list(listParams);

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "查詢客戶列表失敗");
      }

      const items: Customer[] = (data ?? []).map(mapToCustomer);
      const sortedItems = sortField ? sortCustomers(items, sortField) : items;

      return {
        items: sortedItems,
        totalCount: sortedItems.length,
        nextToken: responseNextToken ?? undefined,
      };
    },
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
    queryFn: async (): Promise<Customer> => {
      const { data, errors } = await client.models.Customer.get({ id });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "查詢客戶失敗");
      }

      if (!data) {
        throw new Error("找不到該客戶");
      }

      return mapToCustomer(data);
    },
    enabled: !!id,
  });
}

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
    mutationFn: async (input: CreateCustomerInput): Promise<Customer> => {
      const { data, errors } = await client.models.Customer.create({
        name: input.name,
        contactPerson: input.contactPerson,
        phone: input.phone,
        email: input.email ?? "",
        address: input.address ?? "",
        isActive: true,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "建立客戶失敗");
      }

      if (!data) {
        throw new Error("建立客戶失敗：未回傳資料");
      }

      return mapToCustomer(data);
    },
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
  UpdateCustomerInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCustomerInput): Promise<Customer> => {
      const { data, errors } = await client.models.Customer.update({
        id: input.id,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.contactPerson !== undefined && {
          contactPerson: input.contactPerson,
        }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.address !== undefined && { address: input.address }),
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "更新客戶失敗");
      }

      if (!data) {
        throw new Error("更新客戶失敗：未回傳資料");
      }

      return mapToCustomer(data);
    },
    onSuccess: (updatedCustomer) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: CUSTOMER_KEYS.detail(updatedCustomer.id),
      });
    },
  });
}

/**
 * 停用客戶 mutation hook
 *
 * 將客戶的 isActive 設為 false（停用）。
 * 停用後的客戶不出現在訂單建立的客戶選取清單中，
 * 但歷史訂單仍可顯示該客戶資訊。
 *
 * 需求：1.7
 */
export function useDeactivateCustomer(): UseMutationResult<
  Customer,
  Error,
  { customerId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
    }: {
      customerId: string;
    }): Promise<Customer> => {
      const { data, errors } = await client.models.Customer.update({
        id: customerId,
        isActive: false,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "停用客戶失敗");
      }

      if (!data) {
        throw new Error("停用客戶失敗：未回傳資料");
      }

      return mapToCustomer(data);
    },
    onSuccess: (_, { customerId }) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: CUSTOMER_KEYS.detail(customerId),
      });
    },
  });
}

/**
 * 啟用客戶 mutation hook
 *
 * 將已停用的客戶重新啟用（isActive 設為 true），
 * 恢復在選取清單中的可見性。
 *
 * 需求：1.8
 */
export function useActivateCustomer(): UseMutationResult<
  Customer,
  Error,
  { customerId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
    }: {
      customerId: string;
    }): Promise<Customer> => {
      const { data, errors } = await client.models.Customer.update({
        id: customerId,
        isActive: true,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "啟用客戶失敗");
      }

      if (!data) {
        throw new Error("啟用客戶失敗：未回傳資料");
      }

      return mapToCustomer(data);
    },
    onSuccess: (_, { customerId }) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: CUSTOMER_KEYS.detail(customerId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 將 Amplify Data 回傳的原始資料映射為 Customer 型別 */
function mapToCustomer(raw: Record<string, unknown>): Customer {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    contactPerson: String(raw.contactPerson ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

export { CUSTOMER_KEYS };
