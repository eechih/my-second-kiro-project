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

/**
 * 預簽名 URL 有效期為 1 小時（3600 秒）。
 * staleTime 設為有效期的 80%（48 分鐘），避免每次渲染重複產生新 URL。
 */
const PRESIGNED_URL_STALE_TIME = 48 * 60 * 1000; // 48 分鐘（毫秒）

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const IMAGE_KEYS = {
  all: ["product-images"] as const,
  urls: (imageKeys: string[]) =>
    [...IMAGE_KEYS.all, "urls", ...imageKeys] as const,
  thumbnails: (imageKeys: string[]) =>
    [...IMAGE_KEYS.all, "thumbnails", ...imageKeys] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * 上傳商品照片 mutation hook
 *
 * 使用 Amplify Storage `uploadData` 將檔案上傳至 S3 的
 * `product-images/{productId}/` 路徑。上傳成功後將 S3 key 新增至
 * 商品的 `imageUrls` 陣列並更新商品記錄。
 *
 * 需求：3.9, 3.10
 */
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
      // 產生唯一檔名，避免覆蓋
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `product-images/${productId}/${timestamp}-${sanitizedName}`;

      // 上傳至 S3，加上 productId 標籤方便未來批次清理
      const result = await uploadData({
        path: key,
        data: file,
        options: {
          contentType: file.type,
          metadata: {
            productId,
          },
        },
      }).result;

      const uploadedKey = result.path;

      // 取得目前商品的 imageUrls 並新增新的 key
      const { data: productData, errors: getErrors } =
        await client.models.Product.get(
          { id: productId },
          { selectionSet: ["id", "imageUrls"] },
        );

      if (getErrors && getErrors.length > 0) {
        throw new Error(getErrors[0]?.message ?? "查詢商品失敗");
      }

      if (!productData) {
        throw new Error("找不到該商品");
      }

      const currentImageUrls = Array.isArray(productData.imageUrls)
        ? (productData.imageUrls as string[]).filter(Boolean)
        : [];

      const updatedImageUrls = [...currentImageUrls, uploadedKey];

      // 更新商品記錄
      const { errors: updateErrors } = await client.models.Product.update({
        id: productId,
        imageUrls: updatedImageUrls,
      });

      if (updateErrors && updateErrors.length > 0) {
        throw new Error(updateErrors[0]?.message ?? "更新商品照片記錄失敗");
      }

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

/**
 * 刪除商品照片 mutation hook
 *
 * 使用 Amplify Storage `remove` 刪除 S3 檔案，同時從商品的
 * `imageUrls` 陣列中移除對應 key 並更新商品記錄。
 *
 * 需求：3.11
 */
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
      // 從 S3 刪除原始照片
      await remove({ path: imageKey });

      // 嘗試刪除對應的縮圖（若存在）
      const thumbnailKey = getThumbnailKey(imageKey);
      try {
        await remove({ path: thumbnailKey });
      } catch {
        // 縮圖可能尚未產生或已被刪除，忽略錯誤
      }

      // 取得目前商品的 imageUrls 並移除對應 key
      const { data: productData, errors: getErrors } =
        await client.models.Product.get(
          { id: productId },
          { selectionSet: ["id", "imageUrls"] },
        );

      if (getErrors && getErrors.length > 0) {
        throw new Error(getErrors[0]?.message ?? "查詢商品失敗");
      }

      if (!productData) {
        throw new Error("找不到該商品");
      }

      const currentImageUrls = Array.isArray(productData.imageUrls)
        ? (productData.imageUrls as string[]).filter(Boolean)
        : [];

      const updatedImageUrls = currentImageUrls.filter(
        (key) => key !== imageKey,
      );

      // 更新商品記錄
      const { errors: updateErrors } = await client.models.Product.update({
        id: productId,
        imageUrls: updatedImageUrls,
      });

      if (updateErrors && updateErrors.length > 0) {
        throw new Error(updateErrors[0]?.message ?? "更新商品照片記錄失敗");
      }
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

/**
 * 取得商品照片預簽名 URL 列表 hook
 *
 * 使用 Amplify Storage `getUrl` 將 S3 key 列表轉換為可存取的預簽名 URL 列表，
 * 供前端 `<img>` 標籤顯示使用。
 *
 * 快取策略：staleTime 設為預簽名 URL 有效期的 80%（48 分鐘），
 * 避免每次渲染重複產生新 URL。
 *
 * 需求：3.9, 3.10
 */
export function useProductImageUrls(
  imageKeys: string[],
): UseQueryResult<string[]> {
  return useQuery({
    queryKey: IMAGE_KEYS.urls(imageKeys),
    queryFn: async (): Promise<string[]> => {
      if (imageKeys.length === 0) {
        return [];
      }

      const urls = await Promise.all(
        imageKeys.map(async (key) => {
          const result = await getUrl({ path: key });
          return result.url.toString();
        }),
      );

      return urls;
    },
    enabled: imageKeys.length > 0,
    staleTime: PRESIGNED_URL_STALE_TIME,
  });
}

/**
 * 取得商品縮圖預簽名 URL 列表 hook
 *
 * 將 S3 key 列表轉換為對應縮圖的預簽名 URL 列表（路徑加入 `thumbnails/` 前綴），
 * 用於商品列表頁面（TanStack Table）與預覽顯示，減少頁面載入時間。
 *
 * 快取策略同 `useProductImageUrls`。
 *
 * 需求：3.10
 */
export function useProductThumbnailUrls(
  imageKeys: string[],
): UseQueryResult<string[]> {
  return useQuery({
    queryKey: IMAGE_KEYS.thumbnails(imageKeys),
    queryFn: async (): Promise<string[]> => {
      if (imageKeys.length === 0) {
        return [];
      }

      // 同時取得縮圖與原始照片的 URL，縮圖載入失敗時可 fallback 至原始照片
      const urls = await Promise.all(
        imageKeys.map(async (key) => {
          // 先嘗試取得原始照片 URL 作為保底
          const originalResult = await getUrl({ path: key });
          const originalUrl = originalResult.url.toString();

          // 嘗試取得縮圖 URL
          const thumbnailKey = getThumbnailKey(key);
          try {
            const thumbnailResult = await getUrl({ path: thumbnailKey });
            const thumbnailUrl = thumbnailResult.url.toString();

            // 驗證縮圖是否存在（HEAD request）
            const response = await fetch(thumbnailUrl, { method: "HEAD" });
            if (response.ok) {
              return thumbnailUrl;
            }
          } catch {
            // 縮圖不存在或取得失敗
          }

          // Fallback 至原始照片
          return originalUrl;
        }),
      );

      return urls;
    },
    enabled: imageKeys.length > 0,
    staleTime: PRESIGNED_URL_STALE_TIME,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 將原始照片的 S3 key 轉換為對應縮圖的 key。
 *
 * 原始路徑：product-images/{productId}/{filename}
 * 縮圖路徑：product-images/{productId}/thumbnails/{filename}
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

export { IMAGE_KEYS };
