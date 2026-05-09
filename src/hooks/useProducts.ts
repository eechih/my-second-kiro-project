import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { client } from "@/lib/amplify-client";
import type {
  Product,
  ProductVariant,
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  PaginatedResult,
} from "@shared/models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductStatusFilter = "all" | "active" | "inactive";

export interface ProductListParams {
  pageSize: number;
  nextToken?: string;
  search?: string;
  /** 啟用狀態篩選（undefined 表示全部） */
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const PRODUCT_KEYS = {
  all: ["products"] as const,
  lists: () => [...PRODUCT_KEYS.all, "list"] as const,
  list: (params: ProductListParams) =>
    [...PRODUCT_KEYS.lists(), params] as const,
  details: () => [...PRODUCT_KEYS.all, "detail"] as const,
  detail: (id: string) => [...PRODUCT_KEYS.details(), id] as const,
  variants: (productId: string) =>
    [...PRODUCT_KEYS.all, "variants", productId] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRODUCT_SELECTION_SET = [
  "id",
  "name",
  "sku",
  "unitPrice",
  "defaultCost",
  "defaultSupplierId",
  "stockQuantity",
  "imageUrls",
  "isActive",
  "createdAt",
  "createdAtForSort",
  "updatedAt",
  "variants.*",
] as const;

function buildProductFilter({
  search,
  isActive,
}: Pick<ProductListParams, "search" | "isActive">): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (isActive !== undefined) {
    filter.isActive = { eq: isActive };
  }

  if (search) {
    filter.or = [
      { name: { contains: search } },
      { sku: { contains: search } },
    ];
  }

  return filter;
}

function buildProductListParams({
  pageSize,
  nextToken,
  search,
  isActive,
}: ProductListParams): Record<string, unknown> {
  const filter = buildProductFilter({ search, isActive });
  const listParams: Record<string, unknown> = {
    limit: pageSize,
    selectionSet: PRODUCT_SELECTION_SET,
  };

  if (Object.keys(filter).length > 0) {
    listParams.filter = filter;
  }

  if (nextToken) {
    listParams.nextToken = nextToken;
  }

  return listParams;
}

function applyProductUpdate(
  product: Product,
  input: UpdateProductInput,
): Product {
  return {
    ...product,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.sku !== undefined && { sku: input.sku }),
    ...(input.unitPrice !== undefined && { unitPrice: input.unitPrice }),
    ...(input.defaultCost !== undefined && {
      defaultCost: input.defaultCost,
    }),
    ...(input.defaultSupplierId !== undefined && {
      defaultSupplierId: input.defaultSupplierId,
    }),
    ...(input.stockQuantity !== undefined && {
      stockQuantity: input.stockQuantity,
    }),
    ...(input.imageUrls !== undefined && { imageUrls: input.imageUrls }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  };
}

async function fetchProductList(
  params: ProductListParams,
): Promise<PaginatedResult<string>> {
  const { pageSize, nextToken, search, isActive } = params;

  // 無搜尋條件時使用 GSI 按建立日期降序查詢
  if (!search) {
    const indexFilter: Record<string, unknown> | undefined =
      isActive !== undefined ? { isActive: { eq: isActive } } : undefined;

    const {
      data,
      errors,
      nextToken: responseNextToken,
    } = await client.models.Product.listProductsByCreatedDate(
      { gsiPartition: "Product" },
      {
        sortDirection: "DESC",
        limit: pageSize,
        ...(indexFilter && { filter: indexFilter }),
        ...(nextToken && { nextToken }),
        selectionSet: PRODUCT_SELECTION_SET,
      } as Record<string, unknown>,
    );

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "查詢商品列表失敗");
    }

    const items: Product[] = (data ?? []).map(mapToProduct);

    return {
      items: items.map((product) => product.id),
      totalCount: items.length,
      nextToken: responseNextToken ?? undefined,
    };
  }

  const {
    data,
    errors,
    nextToken: responseNextToken,
  } = await client.models.Product.list(buildProductListParams(params));

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢商品列表失敗");
  }

  const items: Product[] = (data ?? []).map(mapToProduct);

  return {
    items: items.map((product) => product.id),
    totalCount: items.length,
    nextToken: responseNextToken ?? undefined,
  };
}

async function fetchProduct(id: string): Promise<Product> {
  const { data, errors } = await client.models.Product.get(
    { id },
    { selectionSet: PRODUCT_SELECTION_SET },
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢商品失敗");
  }

  if (!data) {
    throw new Error("找不到該商品");
  }

  return mapToProduct(data);
}

async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data, errors } = await client.models.Product.create({
    name: input.name,
    sku: input.sku,
    unitPrice: input.unitPrice,
    defaultCost: input.defaultCost,
    defaultSupplierId: input.defaultSupplierId ?? null,
    stockQuantity: input.stockQuantity ?? 0,
    imageUrls: input.imageUrls ?? [],
    isActive: true,
    gsiPartition: "Product",
    createdAtForSort: new Date().toISOString(),
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "建立商品失敗");
  }

  if (!data) {
    throw new Error("建立商品失敗：未回傳資料");
  }

  return mapToProduct({ ...data, variants: [] });
}

function buildProductUpdatePayload(
  input: UpdateProductInput,
): Record<string, unknown> {
  const updatePayload: Record<string, unknown> = { id: input.id };

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.sku !== undefined) updatePayload.sku = input.sku;
  if (input.unitPrice !== undefined) updatePayload.unitPrice = input.unitPrice;
  if (input.defaultCost !== undefined)
    updatePayload.defaultCost = input.defaultCost;
  if (input.defaultSupplierId !== undefined)
    updatePayload.defaultSupplierId = input.defaultSupplierId;
  if (input.stockQuantity !== undefined)
    updatePayload.stockQuantity = input.stockQuantity;
  if (input.imageUrls !== undefined) updatePayload.imageUrls = input.imageUrls;
  if (input.isActive !== undefined) updatePayload.isActive = input.isActive;

  return updatePayload;
}

async function updateProduct(input: UpdateProductInput): Promise<Product> {
  const { data, errors } = await client.models.Product.update(
    buildProductUpdatePayload(input) as Parameters<
      typeof client.models.Product.update
    >[0],
    { selectionSet: PRODUCT_SELECTION_SET },
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "更新商品失敗");
  }

  if (!data) {
    throw new Error("更新商品失敗：未回傳資料");
  }

  return mapToProduct(data);
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * 商品列表查詢 hook
 *
 * 支援游標式分頁、搜尋與啟用/停用狀態篩選。
 * isActive 為 undefined 時查詢全部狀態。
 * 有規格組合的商品顯示各規格組合庫存加總。
 *
 * 需求：3.1, 3.5
 */
export function useProductList(
  params: ProductListParams,
): UseQueryResult<PaginatedResult<string>> {
  return useQuery({
    queryKey: PRODUCT_KEYS.list(params),
    queryFn: () => fetchProductList(params),
  });
}

/**
 * 單一商品查詢 hook（含規格組合）
 *
 * 需求：3.2, 3.3
 */
export function useProduct(id: string): UseQueryResult<Product> {
  return useQuery({
    queryKey: PRODUCT_KEYS.detail(id),
    queryFn: () => fetchProduct(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * 建立商品 mutation hook
 *
 * 需求：3.2
 */
export function useCreateProduct(): UseMutationResult<
  Product,
  Error,
  CreateProductInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
    },
  });
}

/**
 * 更新商品 mutation hook
 *
 * 需求：3.3
 */
export function useUpdateProduct(): UseMutationResult<
  Product,
  Error,
  UpdateProductInput,
  { previousProduct?: Product }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProduct,
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: PRODUCT_KEYS.detail(input.id),
      });

      const previousProduct = queryClient.getQueryData<Product>(
        PRODUCT_KEYS.detail(input.id),
      );

      if (previousProduct) {
        queryClient.setQueryData<Product>(
          PRODUCT_KEYS.detail(input.id),
          applyProductUpdate(previousProduct, input),
        );
      }

      return { previousProduct };
    },
    onError: (_error, input, context) => {
      if (context?.previousProduct) {
        queryClient.setQueryData(
          PRODUCT_KEYS.detail(input.id),
          context.previousProduct,
        );
      }
    },
    onSuccess: (updatedProduct) => {
      queryClient.setQueryData(
        PRODUCT_KEYS.detail(updatedProduct.id),
        updatedProduct,
      );
    },
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.detail(input.id),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Variant Hooks
// ---------------------------------------------------------------------------

/**
 * 建立規格組合 mutation hook
 *
 * 為指定商品新增單一規格組合。
 *
 * 需求：3.12, 3.13
 */
export function useCreateVariant(): UseMutationResult<
  ProductVariant,
  Error,
  { productId: string; variant: CreateVariantInput }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      variant,
    }: {
      productId: string;
      variant: CreateVariantInput;
    }): Promise<ProductVariant> => {
      const { data, errors } = await client.models.ProductVariant.create({
        productId,
        label: variant.label.trim(),
        price: variant.price ?? null,
        cost: variant.cost ?? null,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "建立規格組合失敗");
      }

      if (!data) {
        throw new Error("建立規格組合失敗：未回傳資料");
      }

      return mapToVariant(data);
    },
    onSuccess: (_, { productId }) => {
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.detail(productId),
      });
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.variants(productId),
      });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
    },
  });
}

/**
 * 更新規格組合 mutation hook
 *
 * 更新規格組合的單價覆寫、成本覆寫或庫存數量。
 *
 * 需求：3.14, 3.15
 */
export function useUpdateVariant(): UseMutationResult<
  ProductVariant,
  Error,
  { productId: string; variantId: string; updates: UpdateVariantInput }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      variantId,
      updates,
    }: {
      productId: string;
      variantId: string;
      updates: UpdateVariantInput;
    }): Promise<ProductVariant> => {
      const updatePayload: Record<string, unknown> = { id: variantId };

      if (updates.price !== undefined)
        updatePayload.price = updates.price;
      if (updates.cost !== undefined)
        updatePayload.cost = updates.cost;

      const { data, errors } = await client.models.ProductVariant.update(
        updatePayload as Parameters<
          typeof client.models.ProductVariant.update
        >[0],
      );

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "更新規格組合失敗");
      }

      if (!data) {
        throw new Error("更新規格組合失敗：未回傳資料");
      }

      return mapToVariant(data);
    },
    onSuccess: (_, { productId }) => {
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.detail(productId),
      });
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.variants(productId),
      });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
    },
  });
}

/**
 * 刪除規格組合 mutation hook
 *
 * 刪除指定規格組合（僅在該規格組合無關聯的訂單明細時允許）。
 *
 * 需求：3.12
 */
export function useDeleteVariant(): UseMutationResult<
  void,
  Error,
  { productId: string; variantId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      variantId,
    }: {
      productId: string;
      variantId: string;
    }): Promise<void> => {
      const { errors } = await client.models.ProductVariant.delete({
        id: variantId,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "刪除規格組合失敗");
      }
    },
    onSuccess: (_, { productId }) => {
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.detail(productId),
      });
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.variants(productId),
      });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 將 Amplify Data 回傳的原始資料映射為 Product 型別 */
function mapToProduct(raw: Record<string, unknown>): Product {
  // 解析 variants（hasMany 關聯回傳的陣列）
  let variants: ProductVariant[] = [];
  if (raw.variants && Array.isArray(raw.variants)) {
    variants = (raw.variants as Record<string, unknown>[]).map(mapToVariant);
  }

  variants.sort((a, b) => a.label.localeCompare(b.label, "zh-TW"));

  // 庫存統一在商品層級管理
  const stockQuantity = Number(raw.stockQuantity ?? 0);

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    sku: String(raw.sku ?? ""),
    unitPrice: Number(raw.unitPrice ?? 0),
    defaultCost: Number(raw.defaultCost ?? 0),
    defaultSupplierId: raw.defaultSupplierId
      ? String(raw.defaultSupplierId)
      : null,
    stockQuantity,
    variants,
    imageUrls: Array.isArray(raw.imageUrls)
      ? (raw.imageUrls as string[]).filter(Boolean)
      : [],
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

/** 將 Amplify Data 回傳的原始資料映射為 ProductVariant 型別 */
function mapToVariant(raw: Record<string, unknown>): ProductVariant {
  return {
    id: String(raw.id ?? ""),
    label: String(raw.label ?? ""),
    price:
      raw.price !== null && raw.price !== undefined
        ? Number(raw.price)
        : null,
    cost:
      raw.cost !== null && raw.cost !== undefined
        ? Number(raw.cost)
        : null,
  };
}

export { PRODUCT_KEYS };
