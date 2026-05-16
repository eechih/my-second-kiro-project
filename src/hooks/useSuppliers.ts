import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { client } from "@/lib/amplify-client";
import { isTranslationSupplier } from "@shared/logic/translation-parser";
import type {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
  PaginatedResult,
} from "@shared/models";

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
export interface SupplierListParams {
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

const SUPPLIER_KEYS = {
  all: ["suppliers"] as const,
  lists: () => [...SUPPLIER_KEYS.all, "list"] as const,
  list: (params: SupplierListParams) =>
    [...SUPPLIER_KEYS.lists(), params] as const,
  details: () => [...SUPPLIER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...SUPPLIER_KEYS.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSupplierFilter({
  search,
  isActive,
}: Pick<SupplierListParams, "search" | "isActive">): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (isActive !== undefined) {
    filter.isActive = { eq: isActive };
  }

  if (search) {
    filter.or = [
      { name: { contains: search } },
      { contactPerson: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  return filter;
}

function buildSupplierListParams({
  pageSize,
  nextToken,
  search,
  isActive,
}: SupplierListParams): Record<string, unknown> {
  const filter = buildSupplierFilter({ search, isActive });
  const listParams: Record<string, unknown> = { limit: pageSize };

  if (nextToken) {
    listParams.nextToken = nextToken;
  }

  if (Object.keys(filter).length > 0) {
    listParams.filter = filter;
  }

  return listParams;
}

function applySupplierUpdate(
  supplier: Supplier,
  input: UpdateSupplierInput,
): Supplier {
  return {
    ...supplier,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.contactPerson !== undefined && {
      contactPerson: input.contactPerson,
    }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.address !== undefined && { address: input.address }),
    ...(input.translationParser !== undefined && {
      translationParser: input.translationParser,
    }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  };
}

async function fetchSupplierList(
  params: SupplierListParams,
): Promise<PaginatedResult<string>> {
  const { sortField } = params;
  const {
    data,
    errors,
    nextToken: responseNextToken,
  } = await client.models.Supplier.list(buildSupplierListParams(params));

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢供應商列表失敗");
  }

  const items: Supplier[] = (data ?? []).map(mapToSupplier);
  const sortedItems = sortField ? sortSuppliers(items, sortField) : items;

  return {
    items: sortedItems.map((supplier) => supplier.id),
    totalCount: sortedItems.length,
    nextToken: responseNextToken ?? undefined,
  };
}

async function fetchSupplier(id: string): Promise<Supplier> {
  const { data, errors } = await client.models.Supplier.get({ id });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢供應商失敗");
  }

  if (!data) {
    throw new Error("找不到該供應商");
  }

  return mapToSupplier(data);
}

async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  const payload: Record<string, unknown> = {
    name: input.name,
    contactPerson: input.contactPerson,
    phone: input.phone,
    email: input.email ?? "",
    address: input.address ?? "",
    translationParser: input.translationParser ?? null,
    isActive: true,
  };

  const { data, errors } = await client.models.Supplier.create(
    payload as Parameters<typeof client.models.Supplier.create>[0],
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "建立供應商失敗");
  }

  if (!data) {
    throw new Error("建立供應商失敗：未回傳資料");
  }

  return mapToSupplier(data);
}

async function updateSupplier(input: UpdateSupplierInput): Promise<Supplier> {
  const payload: Record<string, unknown> = {
    id: input.id,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.contactPerson !== undefined && {
      contactPerson: input.contactPerson,
    }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.address !== undefined && { address: input.address }),
    ...(input.translationParser !== undefined && {
      translationParser: input.translationParser,
    }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  };

  const { data, errors } = await client.models.Supplier.update(
    payload as Parameters<typeof client.models.Supplier.update>[0],
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "更新供應商失敗");
  }

  if (!data) {
    throw new Error("更新供應商失敗：未回傳資料");
  }

  return mapToSupplier(data);
}

/**
 * 依指定欄位排序供應商陣列（升序，字串比較）。
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

/** 將 Amplify Data 回傳的原始資料映射為 Supplier 型別 */
function mapToSupplier(raw: Record<string, unknown>): Supplier {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    contactPerson: String(raw.contactPerson ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    translationParser:
      typeof raw.translationParser === "string" &&
      isTranslationSupplier(raw.translationParser)
        ? raw.translationParser
        : null,
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * 供應商列表查詢 hook（游標式分頁）
 *
 * 使用 TanStack Query 搭配 DynamoDB nextToken 實現游標式分頁。
 * 支援搜尋（name/contactPerson/phone 模糊比對）與 isActive 篩選。
 * isActive 為 undefined 時查詢全部狀態。
 *
 * 需求：2.1, 2.5, 2.9
 */
export function useSupplierList(
  params: SupplierListParams,
): UseQueryResult<PaginatedResult<string>> {
  return useQuery({
    queryKey: SUPPLIER_KEYS.list(params),
    queryFn: () => fetchSupplierList(params),
  });
}

/**
 * 單一供應商查詢 hook
 *
 * 需求：2.2, 2.3
 */
export function useSupplier(id: string): UseQueryResult<Supplier> {
  return useQuery({
    queryKey: SUPPLIER_KEYS.detail(id),
    queryFn: () => fetchSupplier(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * 建立供應商 mutation hook
 *
 * 需求：2.2
 */
export function useCreateSupplier(): UseMutationResult<
  Supplier,
  Error,
  CreateSupplierInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIER_KEYS.lists() });
    },
  });
}

/**
 * 更新供應商 mutation hook
 *
 * 需求：2.3
 */
export function useUpdateSupplier(): UseMutationResult<
  Supplier,
  Error,
  UpdateSupplierInput,
  { previousSupplier?: Supplier }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSupplier,
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: SUPPLIER_KEYS.detail(input.id),
      });

      const previousSupplier = queryClient.getQueryData<Supplier>(
        SUPPLIER_KEYS.detail(input.id),
      );

      if (previousSupplier) {
        queryClient.setQueryData<Supplier>(
          SUPPLIER_KEYS.detail(input.id),
          applySupplierUpdate(previousSupplier, input),
        );
      }

      return { previousSupplier };
    },
    onError: (_error, input, context) => {
      if (context?.previousSupplier) {
        queryClient.setQueryData(
          SUPPLIER_KEYS.detail(input.id),
          context.previousSupplier,
        );
      }
    },
    onSuccess: (updatedSupplier) => {
      queryClient.setQueryData(
        SUPPLIER_KEYS.detail(updatedSupplier.id),
        updatedSupplier,
      );
    },
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: SUPPLIER_KEYS.detail(input.id),
      });
    },
  });
}

export { SUPPLIER_KEYS };
