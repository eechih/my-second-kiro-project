import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { client } from "@/lib/amplify-client";
import type { Customer, PaginatedResult } from "@shared/models";
import type { SortField } from "@/lib/table-utils";
import { sortCustomers } from "@/lib/table-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 狀態篩選型別 */
export type StatusFilter = "all" | "active" | "inactive";

/** 游標式客戶列表查詢參數 */
export interface CustomerListCursorParams {
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

const CUSTOMER_CURSOR_KEYS = {
  all: ["customers", "cursor"] as const,
  list: (params: CustomerListCursorParams) =>
    [...CUSTOMER_CURSOR_KEYS.all, params] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 游標式客戶列表查詢 hook
 *
 * 使用 TanStack Query 搭配 DynamoDB nextToken 實現游標式分頁。
 * 支援搜尋（name/contactPerson/phone 模糊比對）與 isActive 篩選。
 *
 * 需求：1.5, 6.4, 6.5
 */
export function useCustomerListCursor(
  params: CustomerListCursorParams,
): UseQueryResult<PaginatedResult<Customer>> {
  const { pageSize, nextToken, search, isActive, sortField } = params;

  return useQuery({
    queryKey: CUSTOMER_CURSOR_KEYS.list(params),
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

      const listParams: Record<string, unknown> = {
        limit: pageSize,
      };

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

      // 客戶端排序
      const sortedItems = sortField ? sortCustomers(items, sortField) : items;

      return {
        items: sortedItems,
        totalCount: sortedItems.length,
        nextToken: responseNextToken ?? undefined,
      };
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

export { CUSTOMER_CURSOR_KEYS };
