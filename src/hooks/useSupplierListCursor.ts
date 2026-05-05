import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { client } from "@/lib/amplify-client";
import type { Supplier, PaginatedResult } from "@shared/models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 狀態篩選型別 */
export type StatusFilter = "all" | "active" | "inactive";

/** 供應商排序欄位 */
export type SupplierSortField =
  | "name"
  | "contactPerson"
  | "phone"
  | "createdAt";

/** 游標式供應商列表查詢參數 */
export interface SupplierListCursorParams {
  /** 每頁筆數 */
  pageSize: number;
  /** 游標 token（首頁為 undefined） */
  nextToken?: string;
  /** 搜尋關鍵字（模糊比對 name/contactPerson/phone） */
  search?: string;
  /** 啟用狀態篩選（undefined 表示全部） */
  isActive?: boolean;
  /** 排序欄位 */
  sortField?: SupplierSortField;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const SUPPLIER_CURSOR_KEYS = {
  all: ["suppliers", "cursor"] as const,
  list: (params: SupplierListCursorParams) =>
    [...SUPPLIER_CURSOR_KEYS.all, params] as const,
};

// ---------------------------------------------------------------------------
// Sort Helper
// ---------------------------------------------------------------------------

/**
 * 依指定欄位排序供應商陣列（升序，字串比較）
 * 需求：9.5
 *
 * @param suppliers - 供應商陣列
 * @param field - 排序欄位
 * @returns 排序後的新陣列（不修改原陣列）
 */
export function sortSuppliers(
  suppliers: Supplier[],
  field: SupplierSortField,
): Supplier[] {
  return [...suppliers].sort((a, b) => {
    const valueA = a[field] ?? "";
    const valueB = b[field] ?? "";
    return valueA.localeCompare(valueB);
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 游標式供應商列表查詢 hook
 *
 * 使用 TanStack Query 搭配 DynamoDB nextToken 實現游標式分頁。
 * 支援搜尋（name/contactPerson/phone 模糊比對）與 isActive 篩選。
 *
 * 需求：9.1, 9.2, 9.3, 9.4, 9.5
 */
export function useSupplierListCursor(
  params: SupplierListCursorParams,
): UseQueryResult<PaginatedResult<Supplier>> {
  const { pageSize, nextToken, search, isActive, sortField } = params;

  return useQuery({
    queryKey: SUPPLIER_CURSOR_KEYS.list(params),
    queryFn: async (): Promise<PaginatedResult<Supplier>> => {
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
      } = await client.models.Supplier.list(listParams);

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "查詢供應商列表失敗");
      }

      const items: Supplier[] = (data ?? []).map(mapToSupplier);

      // 客戶端排序
      const sortedItems = sortField ? sortSuppliers(items, sortField) : items;

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

/** 將 Amplify Data 回傳的原始資料映射為 Supplier 型別 */
function mapToSupplier(raw: Record<string, unknown>): Supplier {
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

export { SUPPLIER_CURSOR_KEYS };
