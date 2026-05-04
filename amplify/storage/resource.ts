import { defineStorage } from "@aws-amplify/backend";
import { generateThumbnail } from "../functions/generate-thumbnail/resource";

/**
 * Amplify Gen2 Storage（S3）資源定義
 *
 * 儲存桶用於管理商品照片的上傳、刪除與存取。
 *
 * 路徑結構：
 * - product-images/{productId}/{filename}          — 原始商品照片
 * - product-images/{productId}/thumbnails/{filename} — 自動產生的縮圖（300px 寬）
 *
 * 授權規則：
 * - 已驗證使用者可上傳（write）與刪除（delete）商品照片
 * - 所有已驗證使用者可讀取（read）商品照片
 * - generateThumbnail Lambda 函式可讀取原始照片並寫入縮圖
 *
 * 觸發器：
 * - onUpload：檔案上傳後觸發 generateThumbnail Lambda 函式，自動產生縮圖
 */
export const storage = defineStorage({
  name: "productImageStorage",
  access: (allow) => ({
    "product-images/*": [
      allow.authenticated.to(["read", "write", "delete"]),
      allow.resource(generateThumbnail).to(["read", "write"]),
    ],
  }),
  triggers: {
    onUpload: generateThumbnail,
  },
});
