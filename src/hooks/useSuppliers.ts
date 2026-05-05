import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { client } from "@/lib/amplify-client";
import type {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
  PaginatedResult,
} from "@shared/models";

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const SUPPLIER_KEYS = {
  all: ["suppliers"] as const,
  lists: () => [...SUPPLIER_KEYS.all, "list"] as const,
  list: (params: { page: number; search?: string; isActive?: boolean }) =>
    [...SUPPLIER_KEYS.lists(), params] as const,
  details: () => [...SUPPLIER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...SUPPLIER_KEYS.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * 供應商列表查詢 hook
 *
 * 支援分頁、搜尋與啟用/停用狀態篩選。
 * 預設僅查詢啟用中的供應商（isActive = true）。
 *
 * 需求：2.1, 2.5, 2.9
 */
export function useSupplierList(params: {
  page: number;
  search?: string;
  isActive?: boolean;
}): UseQueryResult<PaginatedResult<Supplier>> {
  const { page, search, isActive = true } = params;

  return useQuery({
    queryKey: SUPPLIER_KEYS.list({ page, search, isActive }),
    queryFn: async (): Promise<PaginatedResult<Supplier>> => {
      const filter: Record<string, unknown> = {
        isActive: { eq: isActive },
      };

      if (search) {
        filter.or = [
          { name: { contains: search } },
          { contactPerson: { contains: search } },
          { phone: { contains: search } },
        ];
      }

      const { data, errors } = await client.models.Supplier.list({
        filter,
        limit: 10,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "查詢供應商列表失敗");
      }

      const items: Supplier[] = (data ?? []).map(mapToSupplier);

      return {
        items,
        totalCount: items.length,
      };
    },
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
    queryFn: async (): Promise<Supplier> => {
      const { data, errors } = await client.models.Supplier.get({ id });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "查詢供應商失敗");
      }

      if (!data) {
        throw new Error("找不到該供應商");
      }

      return mapToSupplier(data);
    },
    enabled: !!id,
  });
}

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
    mutationFn: async (input: CreateSupplierInput): Promise<Supplier> => {
      const { data, errors } = await client.models.Supplier.create({
        name: input.name,
        contactPerson: input.contactPerson,
        phone: input.phone,
        email: input.email ?? "",
        address: input.address ?? "",
        isActive: true,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "建立供應商失敗");
      }

      if (!data) {
        throw new Error("建立供應商失敗：未回傳資料");
      }

      return mapToSupplier(data);
    },
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
  UpdateSupplierInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSupplierInput): Promise<Supplier> => {
      const { data, errors } = await client.models.Supplier.update({
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
        throw new Error(errors[0]?.message ?? "更新供應商失敗");
      }

      if (!data) {
        throw new Error("更新供應商失敗：未回傳資料");
      }

      return mapToSupplier(data);
    },
    onSuccess: (updatedSupplier) => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: SUPPLIER_KEYS.detail(updatedSupplier.id),
      });
    },
  });
}

/**
 * 停用供應商 mutation hook
 *
 * 將供應商的 isActive 設為 false（停用）。
 * 停用後的供應商不出現在進貨操作的供應商選取清單中，
 * 但歷史採購記錄仍可顯示該供應商資訊。
 *
 * 需求：2.7
 */
export function useDeactivateSupplier(): UseMutationResult<
  Supplier,
  Error,
  { supplierId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      supplierId,
    }: {
      supplierId: string;
    }): Promise<Supplier> => {
      const { data, errors } = await client.models.Supplier.update({
        id: supplierId,
        isActive: false,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "停用供應商失敗");
      }

      if (!data) {
        throw new Error("停用供應商失敗：未回傳資料");
      }

      return mapToSupplier(data);
    },
    onSuccess: (_, { supplierId }) => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: SUPPLIER_KEYS.detail(supplierId),
      });
    },
  });
}

/**
 * 啟用供應商 mutation hook
 *
 * 將已停用的供應商重新啟用（isActive 設為 true），
 * 恢復在選取清單中的可見性。
 *
 * 需求：2.8
 */
export function useActivateSupplier(): UseMutationResult<
  Supplier,
  Error,
  { supplierId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      supplierId,
    }: {
      supplierId: string;
    }): Promise<Supplier> => {
      const { data, errors } = await client.models.Supplier.update({
        id: supplierId,
        isActive: true,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "啟用供應商失敗");
      }

      if (!data) {
        throw new Error("啟用供應商失敗：未回傳資料");
      }

      return mapToSupplier(data);
    },
    onSuccess: (_, { supplierId }) => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIER_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: SUPPLIER_KEYS.detail(supplierId),
      });
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

export { SUPPLIER_KEYS };
