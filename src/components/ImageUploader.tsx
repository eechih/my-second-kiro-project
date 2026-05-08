import { useState, useRef, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";
import Typography from "@mui/material/Typography";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useUploadProductImage,
  useDeleteProductImage,
  useProductImageUrls,
  useProductThumbnailUrls,
} from "@/hooks/useProductImages";

export interface ImageUploaderProps {
  productId: string;
  imageKeys: string[];
  onUploadComplete?: (newImageKey: string) => void;
  onDeleteComplete?: (deletedImageKey: string) => void;
  disabled?: boolean;
  maxWidth?: number;
  quality?: number;
}

/**
 * 商品照片上傳與管理元件
 *
 * 整合 useProductImages hooks，提供照片上傳、預覽、刪除功能。
 * 上傳前使用 Canvas API 壓縮圖片（最大寬度 1200px、品質 0.8），減少上傳時間。
 * 使用 MUI Button + 隱藏的 <input type="file" accept="image/*" multiple> 實作多檔選取。
 * 上傳中顯示 CircularProgress，已上傳照片以 ImageList 排列（使用縮圖 URL）。
 * 每張照片旁顯示刪除按鈕（IconButton + DeleteIcon），點擊後彈出 ConfirmDialog 確認。
 *
 * 需求：3.9, 3.10, 3.11, 3.12
 */
export function ImageUploader({
  productId,
  imageKeys,
  onUploadComplete,
  onDeleteComplete,
  disabled = false,
  maxWidth = 1200,
  quality = 0.8,
}: ImageUploaderProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    imageKey: string | null;
  }>({ open: false, imageKey: null });
  const [lightbox, setLightbox] = useState<{
    open: boolean;
    index: number;
  }>({ open: false, index: 0 });

  const uploadMutation = useUploadProductImage();
  const deleteMutation = useDeleteProductImage();
  const { data: thumbnailUrls } = useProductThumbnailUrls(imageKeys);
  const { data: fullImageUrls } = useProductImageUrls(imageKeys);

  // --- Image Compression ---

  const compressImage = useCallback(
    (file: File): Promise<File> => {
      return new Promise((resolve, reject) => {
        // If not an image type that can be compressed, return as-is
        if (!file.type.startsWith("image/")) {
          resolve(file);
          return;
        }

        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(url);

          // If image is already smaller than maxWidth, return as-is
          if (img.width <= maxWidth) {
            resolve(file);
            return;
          }

          const canvas = document.createElement("canvas");
          const ratio = maxWidth / img.width;
          canvas.width = maxWidth;
          canvas.height = Math.round(img.height * ratio);

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            "image/jpeg",
            quality,
          );
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("圖片載入失敗"));
        };

        img.src = url;
      });
    },
    [maxWidth, quality],
  );

  // --- Upload Handler ---

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        // Compress image before upload
        const compressedFile = await compressImage(file);

        // Upload to S3
        const newKey = await uploadMutation.mutateAsync({
          productId,
          file: compressedFile,
        });

        onUploadComplete?.(newKey);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "上傳照片失敗");
    } finally {
      setIsUploading(false);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // --- Delete Handlers ---

  const handleDeleteClick = (imageKey: string): void => {
    setDeleteConfirm({ open: true, imageKey });
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteConfirm.imageKey) return;

    const imageKey = deleteConfirm.imageKey;
    setDeleteConfirm({ open: false, imageKey: null });

    try {
      await deleteMutation.mutateAsync({ productId, imageKey });
      onDeleteComplete?.(imageKey);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "刪除照片失敗");
    }
  };

  // --- Lightbox Handlers ---

  const handleImageClick = (index: number): void => {
    setLightbox({ open: true, index });
  };

  const handleCloseLightbox = (): void => {
    setLightbox({ open: false, index: 0 });
  };

  return (
    <Box>
      {/* Upload Button */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={
            isUploading ? <CircularProgress size={16} /> : <CloudUploadIcon />
          }
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          {isUploading ? "上傳中..." : "上傳照片"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void handleFileSelect(e)}
          disabled={disabled || isUploading}
        />
        {imageKeys.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            已上傳 {imageKeys.length} 張照片
          </Typography>
        )}
      </Box>

      {/* Upload Error */}
      {uploadError && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {uploadError}
        </Typography>
      )}

      {/* Image Grid */}
      {imageKeys.length > 0 && (
        <ImageList cols={4} gap={8} sx={{ mt: 1 }}>
          {imageKeys.map((key, index) => {
            const thumbnailUrl = thumbnailUrls?.[index];
            return (
              <ImageListItem
                key={key}
                sx={{
                  cursor: "pointer",
                  borderRadius: 1,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={`商品照片 ${index + 1}`}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: 150,
                      objectFit: "cover",
                    }}
                    onClick={() => handleImageClick(index)}
                    onError={(e) => {
                      // 縮圖可能尚未產生，改用原始照片 URL
                      const fullUrl = fullImageUrls?.[index];
                      if (fullUrl && e.currentTarget.src !== fullUrl) {
                        e.currentTarget.src = fullUrl;
                      }
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: "100%",
                      height: 150,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "grey.100",
                    }}
                    onClick={() => handleImageClick(index)}
                  >
                    <CircularProgress size={24} />
                  </Box>
                )}
                <ImageListItemBar
                  sx={{ background: "transparent" }}
                  position="top"
                  actionPosition="right"
                  actionIcon={
                    <IconButton
                      size="small"
                      sx={{
                        color: "white",
                        bgcolor: "rgba(0,0,0,0.5)",
                        "&:hover": { bgcolor: "rgba(211,47,47,0.8)" },
                        m: 0.5,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(key);
                      }}
                      disabled={disabled || deleteMutation.isPending}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                />
              </ImageListItem>
            );
          })}
        </ImageList>
      )}

      {/* Lightbox Dialog */}
      <Dialog
        open={lightbox.open}
        onClose={handleCloseLightbox}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            py: 1,
          }}
        >
          <Typography variant="subtitle1">
            照片 {lightbox.index + 1} / {imageKeys.length}
          </Typography>
          <IconButton onClick={handleCloseLightbox} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          {fullImageUrls?.[lightbox.index] ? (
            <img
              src={fullImageUrls[lightbox.index]}
              alt={`商品照片 ${lightbox.index + 1}`}
              style={{
                maxWidth: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
              }}
            />
          ) : (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 300,
              }}
            >
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="刪除照片"
        message="確定要刪除這張照片嗎？此操作無法復原。"
        confirmLabel="刪除"
        confirmColor="error"
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteConfirm({ open: false, imageKey: null })}
      />
    </Box>
  );
}
