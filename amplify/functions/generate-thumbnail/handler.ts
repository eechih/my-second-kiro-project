import type { S3Handler } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { logDebug, logError, logInfo, logWarn } from "../debug-log";

const s3Client = new S3Client({});
const FUNCTION_NAME = "generateThumbnail";

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
  logInfo(FUNCTION_NAME, "handler started", {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const objectSize = record.s3.object.size;
    logDebug(FUNCTION_NAME, "record received", { bucket, key, objectSize });

    // 跳過 thumbnails 目錄下的檔案，避免無限迴圈觸發
    if (key.includes("/thumbnails/")) {
      logInfo(FUNCTION_NAME, "record skipped", {
        bucket,
        key,
        reason: "thumbnail-path",
      });
      continue;
    }

    // 僅處理 product-images/ 路徑下的檔案
    if (!key.startsWith("product-images/")) {
      logInfo(FUNCTION_NAME, "record skipped", {
        bucket,
        key,
        reason: "non-product-image-path",
      });
      continue;
    }

    try {
      // 取得原始圖片
      const getResponse = await s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );

      const contentType = getResponse.ContentType ?? "image/jpeg";
      logDebug(FUNCTION_NAME, "source object loaded", {
        bucket,
        key,
        contentType,
        contentLength: getResponse.ContentLength,
      });

      // 僅處理圖片檔案
      if (!contentType.startsWith("image/")) {
        logInfo(FUNCTION_NAME, "record skipped", {
          bucket,
          key,
          contentType,
          reason: "non-image-content-type",
        });
        continue;
      }

      const bodyBytes = await getResponse.Body?.transformToByteArray();
      if (!bodyBytes) {
        logWarn(FUNCTION_NAME, "empty object body", { bucket, key });
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
      logDebug(FUNCTION_NAME, "thumbnail generated", {
        bucket,
        key,
        thumbnailKey,
        sourceBytes: bodyBytes.length,
        thumbnailBytes: thumbnailBuffer.length,
      });

      // 上傳縮圖至 S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: contentType,
        }),
      );

      logInfo(FUNCTION_NAME, "record succeeded", {
        bucket,
        key,
        thumbnailKey,
        contentType,
      });
    } catch (error) {
      logError(FUNCTION_NAME, "record failed", error, { bucket, key });
      // 不拋出錯誤，避免 Lambda 重試導致重複處理
    }
  }

  logInfo(FUNCTION_NAME, "handler completed", {
    recordCount: event.Records.length,
  });
};
