import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { client } from "@/lib/amplify-client";
import { toActiveStatusKey } from "@shared/models";
import type {
  Product,
  ProductOption,
  ProductOptionValue,
  CreateProductInput,
  CreateProductOptionInput,
  UpdateProductInput,
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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRODUCT_SELECTION_SET = [
  "id",
  "name",
  "sku",
  "sequenceNumber",
  "description",
  "price",
  "cost",
  "defaultSupplierId",
  "stockQuantity",
  "imageUrls",
  "isActive",
  "createdAt",
  "createdAtForSort",
  "updatedAt",
  "options.*",
  "options.values.*",
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
    ...(input.description !== undefined && { description: input.description }),
    ...(input.price !== undefined && { price: input.price }),
    ...(input.cost !== undefined && {
      cost: input.cost,
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

function parseCustomMutationResult(
  result: unknown,
): Record<string, unknown> | null {
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

    if (current && typeof current === "object" && !Array.isArray(current)) {
      return current as Record<string, unknown>;
    }

    return null;
  }

  return null;
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
  const { data, errors } = await client.mutations.createProductWithAutoSku({
    name: input.name,
    description: input.description ?? "",
    price: input.price,
    cost: input.cost,
    defaultSupplierId: input.defaultSupplierId ?? null,
    stockQuantity: input.stockQuantity ?? 0,
    imageUrls: input.imageUrls ?? [],
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "建立商品失敗");
  }

  if (!data) {
    throw new Error("建立商品失敗：未回傳資料");
  }

  const resultRecord = parseCustomMutationResult(data) ?? {};
  if (resultRecord.success === false) {
    throw new Error(String(resultRecord.message ?? "建立商品失敗"));
  }

  const productData =
    resultRecord.data && typeof resultRecord.data === "object"
      ? (resultRecord.data as Record<string, unknown>)
      : resultRecord;

  return mapToProduct(productData);
}

function buildProductUpdatePayload(
  input: UpdateProductInput,
): Record<string, unknown> {
  const updatePayload: Record<string, unknown> = { id: input.id };

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.sku !== undefined) updatePayload.sku = input.sku;
  if (input.description !== undefined)
    updatePayload.description = input.description;
  if (input.price !== undefined) updatePayload.price = input.price;
  if (input.cost !== undefined)
    updatePayload.cost = input.cost;
  if (input.defaultSupplierId !== undefined)
    updatePayload.defaultSupplierId = input.defaultSupplierId;
  if (input.stockQuantity !== undefined)
    updatePayload.stockQuantity = input.stockQuantity;
  if (input.imageUrls !== undefined) updatePayload.imageUrls = input.imageUrls;
  if (input.isActive !== undefined) {
    updatePayload.isActive = input.isActive;
    updatePayload.activeStatusKey = toActiveStatusKey(input.isActive);
  }

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
// Product Option Sync Hooks
// ---------------------------------------------------------------------------

function normalizeOptionInputs(
  options: CreateProductOptionInput[],
): CreateProductOptionInput[] {
  return options
    .map((option, optionIndex) => ({
      name: option.name.trim(),
      sortOrder: option.sortOrder ?? optionIndex,
      values: option.values
        .map((value, valueIndex) => ({
          name: value.name.trim(),
          priceOffset: value.priceOffset ?? 0,
          costOffset: value.costOffset ?? 0,
          sortOrder: value.sortOrder ?? valueIndex,
        }))
        .filter((value) => value.name.length > 0),
    }))
    .filter((option) => option.name.length > 0 && option.values.length > 0);
}

async function replaceProductOptions({
  productId,
  options,
}: {
  productId: string;
  options: CreateProductOptionInput[];
}): Promise<void> {
  const normalizedOptions = normalizeOptionInputs(options);

  const existingOptionsResponse = await client.models.ProductOption.listOptionsByProduct(
    { productId },
    {
      selectionSet: ["id", "values.*"],
      limit: 200,
    } as Record<string, unknown>,
  );

  if (existingOptionsResponse.errors && existingOptionsResponse.errors.length > 0) {
    throw new Error(
      existingOptionsResponse.errors[0]?.message ?? "查詢商品規格失敗",
    );
  }

  const existingOptions = (existingOptionsResponse.data ?? []) as Array<
    Record<string, unknown>
  >;

  const existingOptionValueIds = existingOptions.flatMap((option) => {
    const values = Array.isArray(option.values)
      ? (option.values as Array<Record<string, unknown>>)
      : [];
    return values
      .map((value) => value.id)
      .filter((valueId): valueId is unknown => valueId !== undefined && valueId !== null)
      .map((valueId) => String(valueId));
  });

  await Promise.all(
    existingOptionValueIds.map(async (valueId) => {
      const { errors } = await client.models.ProductOptionValue.delete({
        id: valueId,
      });
      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "刪除商品規格值失敗");
      }
    }),
  );

  await Promise.all(
    existingOptions
      .map((option) => option.id)
      .filter((optionId): optionId is unknown => optionId !== undefined && optionId !== null)
      .map(async (optionId) => {
        const { errors } = await client.models.ProductOption.delete({
          id: String(optionId),
        });
        if (errors && errors.length > 0) {
          throw new Error(errors[0]?.message ?? "刪除商品規格失敗");
        }
      }),
  );

  await Promise.all(
    normalizedOptions.map(async (option, optionIndex) => {
      const { data, errors } = await client.models.ProductOption.create({
        productId,
        name: option.name,
        sortOrder: option.sortOrder ?? optionIndex,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "建立商品規格失敗");
      }

      if (!data?.id) {
        throw new Error("建立商品規格失敗：未回傳資料");
      }

      await Promise.all(
        option.values.map(async (value, valueIndex) => {
          const { errors: valueErrors } = await client.models.ProductOptionValue.create(
            {
              optionId: String(data.id),
              name: value.name,
              priceOffset: value.priceOffset ?? 0,
              costOffset: value.costOffset ?? 0,
              sortOrder: value.sortOrder ?? valueIndex,
            },
          );

          if (valueErrors && valueErrors.length > 0) {
            throw new Error(valueErrors[0]?.message ?? "建立商品規格值失敗");
          }
        }),
      );
    }),
  );
}

export function useSyncProductOptions(): UseMutationResult<
  void,
  Error,
  { productId: string; options: CreateProductOptionInput[] }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceProductOptions,
    onSuccess: (_data, { productId }) => {
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.detail(productId),
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
  let options: ProductOption[] = [];
  if (raw.options && Array.isArray(raw.options)) {
    options = (raw.options as Record<string, unknown>[]).map(mapToOption);
  }

  options.sort((a, b) => a.sortOrder - b.sortOrder);

  // 庫存統一在商品層級管理
  const stockQuantity = Number(raw.stockQuantity ?? 0);

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    sku: String(raw.sku ?? ""),
    sequenceNumber: Number(raw.sequenceNumber ?? 0),
    description: String(raw.description ?? ""),
    price: Number(raw.price ?? 0),
    cost: Number(raw.cost ?? 0),
    defaultSupplierId: raw.defaultSupplierId
      ? String(raw.defaultSupplierId)
      : null,
    stockQuantity,
    options,
    imageUrls: Array.isArray(raw.imageUrls)
      ? (raw.imageUrls as string[]).filter(Boolean)
      : [],
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function mapToOptionValue(raw: Record<string, unknown>): ProductOptionValue {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    priceOffset: Number(raw.priceOffset ?? 0),
    costOffset: Number(raw.costOffset ?? 0),
    sortOrder: Number(raw.sortOrder ?? 0),
  };
}

function mapToOption(raw: Record<string, unknown>): ProductOption {
  let values: ProductOptionValue[] = [];
  if (raw.values && Array.isArray(raw.values)) {
    values = (raw.values as Record<string, unknown>[]).map(mapToOptionValue);
  }

  values.sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    sortOrder: Number(raw.sortOrder ?? 0),
    values,
  };
}

export { PRODUCT_KEYS };
