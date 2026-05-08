import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { uploadData, remove, getUrl } from "aws-amplify/storage";
import { client } from "@/lib/amplify-client";
import { PRODUCT_KEYS } from "@/hooks/useProducts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** staleTime 設為預簽名 URL 有效期（1 小時）的 80%，避免重複產生 URL */
const PRESIGNED_URL_STALE_TIME = 48 * 60 * 1000;

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const IMAGE_KEYS = {
  all: ["product-images"] as const,
  urls: (imageKeys: string[]) =>
    [...IMAGE_KEYS.all, "urls", ...imageKeys] as const,
  thumbnail: (imageKey: string) =>
    [...IMAGE_KEYS.all, "thumbnail", imageKey] as const,
  thumbnails: (imageKeys: string[]) =>
    [...IMAGE_KEYS.all, "thumbnails", ...imageKeys] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 將原始照片 S3 key 轉換為對應縮圖 key。
 *
 * product-images/{productId}/{filename}
 * → product-images/{productId}/thumbnails/{filename}
 */
function getThumbnailKey(originalKey: string): string {
  const lastSlashIndex = originalKey.lastIndexOf("/");
  if (lastSlashIndex === -1) {
    return `thumbnails/${originalKey}`;
  }
  const directory = originalKey.substring(0, lastSlashIndex);
  const filename = originalKey.substring(lastSlashIndex + 1);
  return `${directory}/thumbnails/${filename}`;
}

/**
 * 解析單張圖片的最佳顯示 URL：優先使用縮圖，不存在則 fallback 至原圖。
 * 透過 HEAD request 驗證縮圖是否存在。
 */
async function resolveThumbnailUrl(imageKey: string): Promise<string> {
  const originalResult = await getUrl({ path: imageKey });
  const originalUrl = originalResult.url.toString();

  const thumbnailKey = getThumbnailKey(imageKey);
  try {
    const thumbnailResult = await getUrl({ path: thumbnailKey });
    const thumbnailUrl = thumbnailResult.url.toString();
    const response = await fetch(thumbnailUrl, { method: "HEAD" });
    if (response.ok) {
      return thumbnailUrl;
    }
  } catch {
    // 縮圖不存在或取得失敗
  }

  return originalUrl;
}

/** 取得商品目前的 imageUrls 陣列 */
async function fetchProductImageUrls(productId: string): Promise<string[]> {
  const { data, errors } = await client.models.Product.get(
    { id: productId },
    { selectionSet: ["id", "imageUrls"] },
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢商品失敗");
  }
  if (!data) {
    throw new Error("找不到該商品");
  }

  return Array.isArray(data.imageUrls)
    ? (data.imageUrls as string[]).filter(Boolean)
    : [];
}

/** 更新商品的 imageUrls 陣列 */
async function updateProductImageUrls(
  productId: string,
  imageUrls: string[],
): Promise<void> {
  const { errors } = await client.models.Product.update({
    id: productId,
    imageUrls,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "更新商品照片記錄失敗");
  }
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * 取得單張商品縮圖預簽名 URL。
 * 適用於列表 row 等只需一張圖的場景，每張圖獨立快取。
 */
export function useProductThumbnailUrl(
  imageKey: string | undefined,
): UseQueryResult<string | undefined> {
  return useQuery({
    queryKey: IMAGE_KEYS.thumbnail(imageKey ?? ""),
    queryFn: async (): Promise<string | undefined> => {
      if (!imageKey) return undefined;
      return resolveThumbnailUrl(imageKey);
    },
    enabled: !!imageKey,
    staleTime: PRESIGNED_URL_STALE_TIME,
  });
}

/**
 * 取得多張商品縮圖預簽名 URL 列表。
 * 適用於 ImageUploader 等一次顯示多張圖的場景。
 */
export function useProductThumbnailUrls(
  imageKeys: string[],
): UseQueryResult<string[]> {
  return useQuery({
    queryKey: IMAGE_KEYS.thumbnails(imageKeys),
    queryFn: async (): Promise<string[]> => {
      if (imageKeys.length === 0) return [];
      return Promise.all(imageKeys.map(resolveThumbnailUrl));
    },
    enabled: imageKeys.length > 0,
    staleTime: PRESIGNED_URL_STALE_TIME,
  });
}

/**
 * 取得多張商品原始照片預簽名 URL 列表。
 * 用於 Lightbox 全尺寸檢視。
 */
export function useProductImageUrls(
  imageKeys: string[],
): UseQueryResult<string[]> {
  return useQuery({
    queryKey: IMAGE_KEYS.urls(imageKeys),
    queryFn: async (): Promise<string[]> => {
      if (imageKeys.length === 0) return [];
      return Promise.all(
        imageKeys.map(async (key) => {
          const result = await getUrl({ path: key });
          return result.url.toString();
        }),
      );
    },
    enabled: imageKeys.length > 0,
    staleTime: PRESIGNED_URL_STALE_TIME,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/** 上傳商品照片，自動更新商品的 imageUrls 記錄 */
export function useUploadProductImage(): UseMutationResult<
  string,
  Error,
  { productId: string; file: File }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      file,
    }: {
      productId: string;
      file: File;
    }): Promise<string> => {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `product-images/${productId}/${timestamp}-${sanitizedName}`;

      const result = await uploadData({
        path: key,
        data: file,
        options: {
          contentType: file.type,
          metadata: { productId },
        },
      }).result;

      const uploadedKey = result.path;
      const currentUrls = await fetchProductImageUrls(productId);
      await updateProductImageUrls(productId, [...currentUrls, uploadedKey]);

      return uploadedKey;
    },
    onSuccess: (_, { productId }) => {
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.detail(productId),
      });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: IMAGE_KEYS.all });
    },
  });
}

/** 刪除商品照片（含縮圖），自動更新商品的 imageUrls 記錄 */
export function useDeleteProductImage(): UseMutationResult<
  void,
  Error,
  { productId: string; imageKey: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      imageKey,
    }: {
      productId: string;
      imageKey: string;
    }): Promise<void> => {
      // 刪除原始照片
      await remove({ path: imageKey });

      // 嘗試刪除縮圖（可能尚未產生）
      try {
        await remove({ path: getThumbnailKey(imageKey) });
      } catch {
        // ignore
      }

      const currentUrls = await fetchProductImageUrls(productId);
      await updateProductImageUrls(
        productId,
        currentUrls.filter((key) => key !== imageKey),
      );
    },
    onSuccess: (_, { productId }) => {
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.detail(productId),
      });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: IMAGE_KEYS.all });
    },
  });
}

export { IMAGE_KEYS };
