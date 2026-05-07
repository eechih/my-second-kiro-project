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
  SpecDimension,
  PaginatedResult,
} from "@shared/models";
import {
  generateVariants,
  generateVariantSku,
} from "@shared/logic/product-variant";

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
// Product Hooks
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
  const { pageSize, nextToken, search, isActive } = params;

  return useQuery({
    queryKey: PRODUCT_KEYS.list({ pageSize, nextToken, search, isActive }),
    queryFn: async (): Promise<PaginatedResult<string>> => {
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

      // 無搜尋條件時使用 GSI 按建立日期降序查詢
      const useGsi = !search;

      if (useGsi) {
        const indexFilter: Record<string, unknown> | undefined =
          isActive !== undefined ? { isActive: { eq: isActive } } : undefined;

        const {
          data: indexData,
          errors: indexErrors,
          nextToken: indexNextToken,
        } = await client.models.Product.listByCreatedDate(
          { gsiPartition: "Product" },
          {
            sortDirection: "DESC",
            limit: pageSize,
            ...(indexFilter && { filter: indexFilter }),
            ...(nextToken && { nextToken }),
            selectionSet: [
              "id",
              "name",
              "sku",
              "unitPrice",
              "defaultCost",
              "defaultSupplierId",
              "stockQuantity",
              "specDimensions",
              "imageUrls",
              "isActive",
              "version",
              "createdAt",
              "createdDate",
              "updatedAt",
              "variants.*",
            ],
          } as Record<string, unknown>,
        );

        if (indexErrors && indexErrors.length > 0) {
          throw new Error(indexErrors[0]?.message ?? "查詢商品列表失敗");
        }

        const items: Product[] = (indexData ?? []).map(mapToProduct);

        return {
          items: items.map((product) => product.id),
          totalCount: items.length,
          nextToken: indexNextToken ?? undefined,
        };
      }

      const listParams: Record<string, unknown> = {
        limit: pageSize,
        selectionSet: [
          "id",
          "name",
          "sku",
          "unitPrice",
          "defaultCost",
          "defaultSupplierId",
          "stockQuantity",
          "specDimensions",
          "imageUrls",
          "isActive",
          "version",
          "createdAt",
          "createdDate",
          "updatedAt",
          "variants.*",
        ],
      };

      if (Object.keys(filter).length > 0) {
        listParams.filter = filter;
      }

      if (nextToken) {
        listParams.nextToken = nextToken;
      }

      const {
        data,
        errors,
        nextToken: responseNextToken,
      } = await client.models.Product.list(listParams);

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "查詢商品列表失敗");
      }

      const items: Product[] = (data ?? []).map(mapToProduct);

      return {
        items: items.map((product) => product.id),
        totalCount: items.length,
        nextToken: responseNextToken ?? undefined,
      };
    },
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
    queryFn: async (): Promise<Product> => {
      const { data, errors } = await client.models.Product.get(
        { id },
        {
          selectionSet: [
            "id",
            "name",
            "sku",
            "unitPrice",
            "defaultCost",
            "defaultSupplierId",
            "stockQuantity",
            "specDimensions",
            "imageUrls",
            "isActive",
            "version",
            "createdAt",
            "updatedAt",
            "variants.*",
          ],
        },
      );

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "查詢商品失敗");
      }

      if (!data) {
        throw new Error("找不到該商品");
      }

      return mapToProduct(data);
    },
    enabled: !!id,
  });
}

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
    mutationFn: async (input: CreateProductInput): Promise<Product> => {
      const { data, errors } = await client.models.Product.create({
        name: input.name,
        sku: input.sku,
        unitPrice: input.unitPrice,
        defaultCost: input.defaultCost,
        defaultSupplierId: input.defaultSupplierId ?? null,
        stockQuantity: input.stockQuantity ?? 0,
        specDimensions: JSON.stringify(input.specDimensions ?? []),
        imageUrls: input.imageUrls ?? [],
        isActive: true,
        version: 1,
        gsiPartition: "Product",
        createdDate: new Date().toISOString(),
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "建立商品失敗");
      }

      if (!data) {
        throw new Error("建立商品失敗：未回傳資料");
      }

      return mapToProduct({ ...data, variants: [] });
    },
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
    mutationFn: async (input: UpdateProductInput): Promise<Product> => {
      const updatePayload: Record<string, unknown> = { id: input.id };

      if (input.name !== undefined) updatePayload.name = input.name;
      if (input.sku !== undefined) updatePayload.sku = input.sku;
      if (input.unitPrice !== undefined)
        updatePayload.unitPrice = input.unitPrice;
      if (input.defaultCost !== undefined)
        updatePayload.defaultCost = input.defaultCost;
      if (input.defaultSupplierId !== undefined)
        updatePayload.defaultSupplierId = input.defaultSupplierId;
      if (input.stockQuantity !== undefined)
        updatePayload.stockQuantity = input.stockQuantity;
      if (input.specDimensions !== undefined)
        updatePayload.specDimensions = JSON.stringify(input.specDimensions);
      if (input.imageUrls !== undefined)
        updatePayload.imageUrls = input.imageUrls;
      if (input.isActive !== undefined) updatePayload.isActive = input.isActive;

      const { data, errors } = await client.models.Product.update(
        updatePayload as Parameters<typeof client.models.Product.update>[0],
        {
          selectionSet: [
            "id",
            "name",
            "sku",
            "unitPrice",
            "defaultCost",
            "defaultSupplierId",
            "stockQuantity",
            "specDimensions",
            "imageUrls",
            "isActive",
            "version",
            "createdAt",
            "updatedAt",
            "variants.*",
          ],
        },
      );

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "更新商品失敗");
      }

      if (!data) {
        throw new Error("更新商品失敗：未回傳資料");
      }

      return mapToProduct(data);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: PRODUCT_KEYS.detail(input.id),
      });

      const previousProduct = queryClient.getQueryData<Product>(
        PRODUCT_KEYS.detail(input.id),
      );

      const applyUpdate = (product: Product): Product => ({
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
        ...(input.specDimensions !== undefined && {
          specDimensions: input.specDimensions,
        }),
        ...(input.imageUrls !== undefined && { imageUrls: input.imageUrls }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      });

      if (previousProduct) {
        queryClient.setQueryData<Product>(
          PRODUCT_KEYS.detail(input.id),
          applyUpdate(previousProduct),
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
 * 為指定商品新增單一規格組合，自動產生 SKU（若未自訂）。
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
      // 若未提供 SKU，需要取得商品 SKU 來自動產生
      let sku = variant.sku ?? "";
      if (!sku) {
        const { data: productData } = await client.models.Product.get({
          id: productId,
        });
        const productSku = String(productData?.sku ?? "");
        sku = generateVariantSku(productSku, variant.combination);
      }

      const { data, errors } = await client.models.ProductVariant.create({
        productId,
        combination: JSON.stringify(variant.combination),
        label: variant.label,
        sku,
        stockQuantity: variant.stockQuantity ?? 0,
        unitPriceOverride: variant.unitPriceOverride ?? null,
        defaultCostOverride: variant.defaultCostOverride ?? null,
        version: 1,
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
 * 更新規格組合的 SKU、單價覆寫、成本覆寫或庫存數量。
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

      if (updates.sku !== undefined) updatePayload.sku = updates.sku;
      if (updates.stockQuantity !== undefined)
        updatePayload.stockQuantity = updates.stockQuantity;
      if (updates.unitPriceOverride !== undefined)
        updatePayload.unitPriceOverride = updates.unitPriceOverride;
      if (updates.defaultCostOverride !== undefined)
        updatePayload.defaultCostOverride = updates.defaultCostOverride;

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

/**
 * 自動產生規格組合 mutation hook
 *
 * 根據規格維度自動產生所有規格組合（笛卡爾積），
 * 已存在的組合保留不變，僅新增缺少的組合。
 *
 * 需求：3.13, 3.14
 */
export function useGenerateVariants(): UseMutationResult<
  ProductVariant[],
  Error,
  { productId: string; specDimensions: SpecDimension[] }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      specDimensions,
    }: {
      productId: string;
      specDimensions: SpecDimension[];
    }): Promise<ProductVariant[]> => {
      // 取得商品資訊（SKU 用於自動產生規格組合 SKU）
      const { data: productData, errors: productErrors } =
        await client.models.Product.get(
          { id: productId },
          { selectionSet: ["id", "sku", "variants.*"] },
        );

      if (productErrors && productErrors.length > 0) {
        throw new Error(productErrors[0]?.message ?? "查詢商品失敗");
      }

      if (!productData) {
        throw new Error("找不到該商品");
      }

      const productSku = String(productData.sku ?? "");

      // 取得目前已存在的規格組合
      const existingVariants: ProductVariant[] = ((
        productData as Record<string, unknown>
      ).variants as Record<string, unknown>[] | undefined)
        ? ((
            (productData as Record<string, unknown>).variants as Record<
              string,
              unknown
            >[]
          ).map(mapToVariant) ?? [])
        : [];

      // 檢查是否有未完成的訂單明細引用這些規格組合
      if (existingVariants.length > 0) {
        const variantIds = existingVariants.map((v) => v.id);
        for (const variantId of variantIds) {
          const { data: lineItems } = await client.models.LineItem.list({
            filter: {
              variantId: { eq: variantId },
              status: { ne: "已出貨" },
            },
            limit: 1,
          });
          if (lineItems && lineItems.length > 0) {
            throw new Error(
              "無法覆蓋規格組合：仍有未完成的訂單明細引用現有規格組合，請先處理相關訂單。",
            );
          }
        }
      }

      // 產生所有應存在的規格組合
      const allCombinations = generateVariants(specDimensions);

      // 刪除所有既有規格組合（覆蓋模式，並發執行）
      await Promise.all(
        existingVariants.map(async (variant) => {
          const { errors: deleteErrors } =
            await client.models.ProductVariant.delete({ id: variant.id });
          if (deleteErrors && deleteErrors.length > 0) {
            throw new Error(deleteErrors[0]?.message ?? "刪除規格組合失敗");
          }
        }),
      );

      // 批次建立新的規格組合（並發執行）
      const createdVariants: ProductVariant[] = await Promise.all(
        allCombinations.map(async (combo) => {
          const sku = generateVariantSku(productSku, combo.combination);

          const { data, errors } = await client.models.ProductVariant.create({
            productId,
            combination: JSON.stringify(combo.combination),
            label: combo.label,
            sku,
            stockQuantity: 0,
            unitPriceOverride: null,
            defaultCostOverride: null,
            version: 1,
          });

          if (errors && errors.length > 0) {
            throw new Error(errors[0]?.message ?? "建立規格組合失敗");
          }

          return mapToVariant(data!);
        }),
      );

      // 同時更新商品的 specDimensions
      await client.models.Product.update({
        id: productId,
        specDimensions: JSON.stringify(specDimensions),
      });

      return createdVariants;
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
  // 解析 specDimensions（JSON 字串或已解析的物件）
  let specDimensions: SpecDimension[] = [];
  if (raw.specDimensions) {
    try {
      specDimensions =
        typeof raw.specDimensions === "string"
          ? JSON.parse(raw.specDimensions)
          : (raw.specDimensions as SpecDimension[]);
    } catch {
      specDimensions = [];
    }
  }

  // 解析 variants（hasMany 關聯回傳的陣列）
  let variants: ProductVariant[] = [];
  if (raw.variants && Array.isArray(raw.variants)) {
    variants = (raw.variants as Record<string, unknown>[]).map(mapToVariant);
  }

  // 依規格維度定義順序排序 variants
  if (variants.length > 0 && specDimensions.length > 0) {
    variants.sort((a, b) => {
      for (const dim of specDimensions) {
        const aIndex = dim.values.indexOf(
          (a.combination as Record<string, string>)[dim.name] ?? "",
        );
        const bIndex = dim.values.indexOf(
          (b.combination as Record<string, string>)[dim.name] ?? "",
        );
        if (aIndex !== bIndex) return aIndex - bIndex;
      }
      return 0;
    });
  }

  // 計算庫存：有規格組合時顯示各規格組合庫存加總
  const stockQuantity =
    variants.length > 0
      ? variants.reduce((sum, v) => sum + v.stockQuantity, 0)
      : Number(raw.stockQuantity ?? 0);

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
    specDimensions,
    variants,
    imageUrls: Array.isArray(raw.imageUrls)
      ? (raw.imageUrls as string[]).filter(Boolean)
      : [],
    isActive: raw.isActive !== false,
    version: Number(raw.version ?? 1),
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

/** 將 Amplify Data 回傳的原始資料映射為 ProductVariant 型別 */
function mapToVariant(raw: Record<string, unknown>): ProductVariant {
  let combination: Record<string, string> = {};
  if (raw.combination) {
    try {
      combination =
        typeof raw.combination === "string"
          ? JSON.parse(raw.combination)
          : (raw.combination as Record<string, string>);
    } catch {
      combination = {};
    }
  }

  return {
    id: String(raw.id ?? ""),
    combination,
    label: String(raw.label ?? ""),
    sku: String(raw.sku ?? ""),
    stockQuantity: Number(raw.stockQuantity ?? 0),
    unitPriceOverride:
      raw.unitPriceOverride !== null && raw.unitPriceOverride !== undefined
        ? Number(raw.unitPriceOverride)
        : null,
    defaultCostOverride:
      raw.defaultCostOverride !== null && raw.defaultCostOverride !== undefined
        ? Number(raw.defaultCostOverride)
        : null,
    version: Number(raw.version ?? 1),
  };
}

export { PRODUCT_KEYS };
