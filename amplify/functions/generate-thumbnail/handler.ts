import type { S3Handler } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const s3Client = new S3Client({});

/**
 * S3 上傳事件觸發的縮圖產生 Lambda 函式。
 *
 * 當檔案上傳至 product-images/{productId}/ 路徑時觸發，
 * 自動產生 300px 寬的縮圖，存放於 product-images/{productId}/thumbnails/ 路徑。
 *
 * 跳過條件：
 * - 已在 thumbnails/ 路徑下的檔案（避免無限迴圈）
 * - 非圖片檔案（依 Content-Type 判斷）
 */
export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // 跳過 thumbnails 目錄下的檔案，避免無限迴圈觸發
    if (key.includes("/thumbnails/")) {
      console.log(`跳過縮圖檔案：${key}`);
      continue;
    }

    // 僅處理 product-images/ 路徑下的檔案
    if (!key.startsWith("product-images/")) {
      console.log(`跳過非商品照片路徑：${key}`);
      continue;
    }

    try {
      // 取得原始圖片
      const getResponse = await s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );

      const contentType = getResponse.ContentType ?? "image/jpeg";

      // 僅處理圖片檔案
      if (!contentType.startsWith("image/")) {
        console.log(`跳過非圖片檔案：${key}（Content-Type: ${contentType}）`);
        continue;
      }

      const bodyBytes = await getResponse.Body?.transformToByteArray();
      if (!bodyBytes) {
        console.error(`無法讀取檔案內容：${key}`);
        continue;
      }

      // 使用 sharp 產生 300px 寬的縮圖
      const thumbnailBuffer = await sharp(Buffer.from(bodyBytes))
        .resize({ width: 300, withoutEnlargement: true })
        .toBuffer();

      // 計算縮圖的 S3 key
      // 原始路徑：product-images/{productId}/filename.jpg
      // 縮圖路徑：product-images/{productId}/thumbnails/filename.jpg
      const pathParts = key.split("/");
      const fileName = pathParts.pop()!;
      const basePath = pathParts.join("/");
      const thumbnailKey = `${basePath}/thumbnails/${fileName}`;

      // 上傳縮圖至 S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: contentType,
        }),
      );

      console.log(`縮圖產生成功：${thumbnailKey}`);
    } catch (error) {
      console.error(`處理檔案 ${key} 時發生錯誤：`, error);
      // 不拋出錯誤，避免 Lambda 重試導致重複處理
    }
  }
};
