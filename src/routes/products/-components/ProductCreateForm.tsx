import { FormField } from "@/components/FormField";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { parseSupplierTranslationPost } from "@shared/logic/translation-parser";
import type { CreateProductOptionInput, Supplier } from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import {
  ProductFormSection,
  SupplierSelect,
  useSupplierOptions,
} from "./ProductFormShared";
import {
  mapEditableOptionsToCreateInput,
  ProductOptionEditor,
  type EditableProductOption,
} from "./ProductOptionEditor";

export interface ProductCreateFormValues {
  name: string;
  description: string;
  price: number;
  cost: number;
  stockQuantity: number;
  defaultSupplierId: string | null;
  options: CreateProductOptionInput[];
  imageFiles: File[];
}

export interface ProductCreateFormProps {
  formId: string;
  resetToken?: number;
  onSubmit: (values: ProductCreateFormValues) => Promise<void>;
}

function mapParsedOptionsToEditableOptions(
  options?: string[][],
): EditableProductOption[] {
  if (!options || options.length === 0) {
    return [];
  }

  return options
    .map((group, groupIndex) => ({
      name: `選項 ${groupIndex + 1}`,
      values: group
        .map((option) => option.trim())
        .filter(Boolean)
        .map((option) => ({
          name: option,
          priceOffset: 0,
          costOffset: 0,
        })),
    }))
    .filter((option) => option.values.length > 0);
}

export function ProductCreateForm({
  formId,
  resetToken = 0,
  onSubmit,
}: ProductCreateFormProps): React.ReactElement {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [options, setOptions] = useState<EditableProductOption[]>([]);
  const [parserPostContent, setParserPostContent] = useState("");
  const [parserError, setParserError] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suppliersQuery = useSupplierOptions();

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      cost: 0,
      stockQuantity: 0,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        name: value.name,
        description: value.description,
        price: Math.trunc(value.price),
        cost: Math.trunc(value.cost),
        stockQuantity: value.stockQuantity,
        defaultSupplierId: selectedSupplier?.id ?? null,
        options: mapEditableOptionsToCreateInput(options),
        imageFiles,
      });
    },
  });

  useEffect(() => {
    const nextUrls = imageFiles.map((file) => URL.createObjectURL(file));
    setImagePreviewUrls(nextUrls);

    return () => {
      for (const url of nextUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [imageFiles]);

  useEffect(() => {
    form.reset({
      name: "",
      description: "",
      price: 0,
      cost: 0,
      stockQuantity: 0,
    });
    setOptions([]);
    setParserPostContent("");
    setParserError(null);
    setImageFiles([]);
    setIsDragActive(false);
  }, [form, resetToken]);

  const appendImageFiles = (files: FileList | File[]): void => {
    const nextFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (nextFiles.length === 0) return;

    setImageFiles((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
      );
      const deduped = nextFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        return !existingKeys.has(key);
      });
      return [...prev, ...deduped];
    });
  };

  const removeImageFile = (index: number): void => {
    setImageFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleImageInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    if (!event.target.files || event.target.files.length === 0) return;
    appendImageFiles(event.target.files);
    event.target.value = "";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    if (!event.dataTransfer.files || event.dataTransfer.files.length === 0) {
      return;
    }
    appendImageFiles(event.dataTransfer.files);
  };

  const productFields = (
    <>
      <form.Field
        name="name"
        validators={{
          onBlur: ({ value }) => (!value.trim() ? "商品名稱為必填" : undefined),
        }}
      >
        {(field) => <FormField field={field} label="商品名稱" required />}
      </form.Field>

      <form.Field
        name="price"
        validators={{
          onBlur: ({ value }) => (value < 0 ? "單價不可為負數" : undefined),
        }}
      >
        {(field) => (
          <FormField field={field} label="預設單價" type="number" required />
        )}
      </form.Field>

      <form.Field
        name="cost"
        validators={{
          onBlur: ({ value }) => (value < 0 ? "進貨成本不可為負數" : undefined),
        }}
      >
        {(field) => (
          <FormField
            field={field}
            label="預設進貨成本"
            type="number"
            required
          />
        )}
      </form.Field>

      <form.Field name="stockQuantity">
        {(field) => (
          <FormField field={field} label="初始庫存數量" type="number" />
        )}
      </form.Field>

      <SupplierSelect
        label="預設供應商"
        value={selectedSupplier}
        onChange={setSelectedSupplier}
        suppliers={suppliersQuery.data ?? []}
        isLoading={suppliersQuery.isLoading}
        isFetching={suppliersQuery.isFetching}
        error={suppliersQuery.error}
      />
    </>
  );

  const variantSection = (
    <ProductFormSection
      title="規格設定"
      description="先定義規格名稱，再為每個規格值設定加價與成本增加。"
      sx={{ p: 2 }}
    >
      <ProductOptionEditor value={options} onChange={setOptions} />
    </ProductFormSection>
  );

  const skuNotice = (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <InfoOutlinedIcon color="info" fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          SKU 會在建立商品後自動產生，格式為 SKU-000001，並依建立順序遞增。
        </Typography>
      </Box>
    </Paper>
  );

  const photoSection = (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <InfoOutlinedIcon color="info" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            可一次拖拉多張圖片，商品建立後會自動上傳並綁定到商品。
          </Typography>
        </Box>

        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: "2px dashed",
            borderColor: isDragActive ? "primary.main" : "divider",
            bgcolor: isDragActive ? "action.hover" : "background.default",
            borderRadius: 2,
            px: 3,
            py: 4,
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color 0.2s ease, background-color 0.2s ease",
          }}
        >
          <Stack spacing={1} sx={{ alignItems: "center" }}>
            <CloudUploadOutlinedIcon color="primary" fontSize="large" />
            <Typography variant="subtitle1">
              拖拉圖片到這裡，或點擊選取多張照片
            </Typography>
            <Typography variant="body2" color="text.secondary">
              支援一次加入多張圖片，建立商品後會自動上傳。
            </Typography>
          </Stack>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleImageInputChange}
          />
        </Box>

        {imageFiles.length > 0 && (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              已選擇 {imageFiles.length} 張照片
            </Typography>
            <ImageList cols={4} gap={8} sx={{ mt: 0 }}>
              {imagePreviewUrls.map((previewUrl, index) => {
                const file = imageFiles[index];
                if (!file) return null;

                return (
                  <ImageListItem
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    sx={{
                      borderRadius: 1,
                      overflow: "hidden",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <img
                      src={previewUrl}
                      alt={`待上傳商品照片 ${index + 1}`}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: 150,
                        objectFit: "cover",
                      }}
                    />
                    <ImageListItemBar
                      title={file.name}
                      subtitle={`${Math.round(file.size / 1024)} KB`}
                      actionIcon={
                        <IconButton
                          size="small"
                          sx={{
                            color: "white",
                            bgcolor: "rgba(0,0,0,0.45)",
                            mr: 0.5,
                            "&:hover": { bgcolor: "rgba(211,47,47,0.8)" },
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeImageFile(index);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                    />
                  </ImageListItem>
                );
              })}
            </ImageList>
          </Stack>
        )}
      </Stack>
    </Paper>
  );

  const descriptionField = (
    <form.Field name="description">
      {(field) => (
        <FormField field={field} label="產品描述" multiline minRows={10} />
      )}
    </form.Field>
  );

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  const parserTranslation = selectedSupplier?.translationParser ?? null;
  const parserSupplierError =
    selectedSupplier && !parserTranslation
      ? "此供應商尚未設定貼文解析器，請先到供應商資料設定後再解析。"
      : null;

  const handleParserClear = (): void => {
    setParserPostContent("");
    setParserError(null);
  };

  const handleParserApply = (): void => {
    setParserError(null);

    if (!selectedSupplier) {
      setParserError("請先選擇供應商");
      return;
    }

    if (!parserTranslation) {
      setParserError("此供應商尚未設定貼文解析器");
      return;
    }

    if (!parserPostContent.trim()) {
      setParserError("請先貼上 FB 貼文內容");
      return;
    }

    try {
      const result = parseSupplierTranslationPost(
        parserTranslation,
        parserPostContent,
      );

      form.setFieldValue("name", result.name ?? "");
      form.setFieldValue("description", result.description ?? "");
      form.setFieldValue(
        "price",
        result.price && result.price > 0 ? result.price : 0,
      );
      form.setFieldValue(
        "cost",
        result.cost && result.cost > 0 ? result.cost : 0,
      );
      setOptions(mapParsedOptionsToEditableOptions(result.option));
    } catch (error) {
      setParserError(
        error instanceof Error ? error.message : "解析 FB 貼文失敗",
      );
    }
  };

  const parserSection = (
    <ProductFormSection sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        {parserError && (
          <Alert severity="error" onClose={() => setParserError(null)}>
            {parserError}
          </Alert>
        )}
        {parserSupplierError && (
          <Alert severity="warning">{parserSupplierError}</Alert>
        )}

        <Typography variant="body2" color="text.secondary">
          選擇供應商後貼上貼文內容，系統會用對應的解析器預填商品資料。
        </Typography>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="text"
            startIcon={<CleaningServicesIcon />}
            onClick={handleParserClear}
            disabled={!parserPostContent}
          >
            清除貼文內容
          </Button>
          <Button
            variant="contained"
            onClick={handleParserApply}
            disabled={
              !selectedSupplier ||
              !parserTranslation ||
              !parserPostContent.trim()
            }
          >
            解析並填入表單
          </Button>
        </Box>

        <SupplierSelect
          label="解析供應商"
          value={selectedSupplier}
          onChange={(supplier) => {
            setSelectedSupplier(supplier);
            setParserError(null);
          }}
          suppliers={suppliersQuery.data ?? []}
          isLoading={suppliersQuery.isLoading}
          isFetching={suppliersQuery.isFetching}
          error={suppliersQuery.error}
        />

        <TextField
          label="FB 貼文內容"
          value={parserPostContent}
          onChange={(event) => {
            setParserPostContent(event.target.value);
            setParserError(null);
          }}
          multiline
          minRows={8}
          fullWidth
        />
      </Stack>
    </ProductFormSection>
  );

  return (
    <form id={formId} onSubmit={handleFormSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 4 }}>{parserSection}</Grid>
        <Grid size={{ xs: 12, lg: 8 }} container>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Stack spacing={2}>
              {skuNotice}
              <Paper sx={{ p: 2 }}>
                <Stack spacing={2}>{productFields}</Stack>
              </Paper>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper sx={{ p: 2 }}>{descriptionField}</Paper>
          </Grid>

          <Grid size={12}>{variantSection}</Grid>
          <Grid size={12}>{photoSection}</Grid>
        </Grid>
      </Grid>
    </form>
  );
}
