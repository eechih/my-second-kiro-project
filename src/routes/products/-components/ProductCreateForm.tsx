import { FormField } from "@/components/FormField";
import { client } from "@/lib/amplify-client";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  isTranslationSupplier,
  parseSupplierTranslationPost,
} from "@shared/logic/translation-parser";
import { parseVariantLabels } from "@shared/logic/variant-labels";
import type { CreateVariantInput, Supplier } from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export interface ProductCreateFormValues {
  name: string;
  description: string;
  price: number;
  cost: number;
  stockQuantity: number;
  defaultSupplierId: string | null;
  variants: CreateVariantInput[];
  imageFiles: File[];
}

export interface ProductCreateFormProps {
  formId: string;
  layout?: "default" | "splitDescription";
  onSubmit: (values: ProductCreateFormValues) => Promise<void>;
}

function mapSupplier(raw: Record<string, unknown>): Supplier {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    contactPerson: String(raw.contactPerson ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    translationParser:
      typeof raw.translationParser === "string" &&
      isTranslationSupplier(raw.translationParser)
        ? raw.translationParser
        : null,
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function formatParsedOptions(options?: string[][]): string {
  if (!options || options.length === 0) {
    return "";
  }

  return options
    .map((group) => group.map((option) => option.trim()).filter(Boolean))
    .filter((group) => group.length > 0)
    .map((group) => group.join("，"))
    .join("/");
}

function useSupplierOptions() {
  return useQuery({
    queryKey: ["suppliers", "select-options"],
    queryFn: async () => {
      const { data, errors } = await client.models.Supplier.list({
        filter: { isActive: { eq: true } },
        limit: 200,
      });
      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "查詢供應商失敗");
      }
      return (data ?? []).map((raw) =>
        mapSupplier(raw as unknown as Record<string, unknown>),
      );
    },
    staleTime: 60_000,
  });
}

function SupplierSelect({
  label,
  value,
  onChange,
  suppliers,
  isLoading,
  isFetching,
  error,
}: {
  label: string;
  value: Supplier | null;
  onChange: (supplier: Supplier | null) => void;
  suppliers: Supplier[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
}): React.ReactElement {
  const errorMessage =
    error instanceof Error ? error.message : error ? "查詢供應商失敗" : "";

  return (
    <FormControl fullWidth error={!!error} disabled={isLoading}>
      <InputLabel id={`${label}-label`}>{label}</InputLabel>
      <Select
        labelId={`${label}-label`}
        label={label}
        value={value?.id ?? ""}
        onChange={(event) => {
          const supplier =
            suppliers.find((option) => option.id === event.target.value) ??
            null;
          onChange(supplier);
        }}
        endAdornment={
          isFetching ? (
            <CircularProgress color="inherit" size={20} sx={{ mr: 3 }} />
          ) : undefined
        }
      >
        <MenuItem value="">未指定</MenuItem>
        {suppliers.map((supplier) => (
          <MenuItem key={supplier.id} value={supplier.id}>
            {supplier.name}
          </MenuItem>
        ))}
      </Select>
      {errorMessage && <FormHelperText>{errorMessage}</FormHelperText>}
    </FormControl>
  );
}

export function ProductCreateForm({
  formId,
  layout = "default",
  onSubmit,
}: ProductCreateFormProps): React.ReactElement {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [variantInput, setVariantInput] = useState("");
  const [parserPostContent, setParserPostContent] = useState("");
  const [parserError, setParserError] = useState<string | null>(null);
  const [parserMessage, setParserMessage] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantLabels = parseVariantLabels(variantInput);
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
        variants: variantLabels.map((label) => ({
          label,
          priceOffset: null,
          costOffset: null,
        })),
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
    <Paper sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6">快速規格定義</Typography>
        <TextField
          label="規格選項"
          value={variantInput}
          onChange={(event) => setVariantInput(event.target.value)}
          placeholder="[黑，白，藍/M，L，XL，2L，3L]"
          helperText="使用 / 分隔規格層級，使用逗號分隔選項；會帶入產品預設單價與預設成本。"
        />
        {variantLabels.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {variantLabels.map((label) => (
              <Chip key={label} label={label} size="small" />
            ))}
          </Box>
        )}
      </Stack>
    </Paper>
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
    setParserMessage(null);
  };

  const handleParserApply = (): void => {
    setParserError(null);
    setParserMessage(null);

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
      setVariantInput(formatParsedOptions(result.option));

      setParserMessage(
        result.name
          ? "已解析貼文並填入商品表單，請確認欄位後送出；SKU 會在建立時自動產生。"
          : "已完成解析，但未抓到商品名稱，請手動補上表單欄位。",
      );
    } catch (error) {
      setParserError(
        error instanceof Error ? error.message : "解析 FB 貼文失敗",
      );
    }
  };

  const parserSection = (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        {parserError && (
          <Alert severity="error" onClose={() => setParserError(null)}>
            {parserError}
          </Alert>
        )}
        {parserSupplierError && (
          <Alert severity="warning">{parserSupplierError}</Alert>
        )}
        {parserMessage && (
          <Alert severity="success" onClose={() => setParserMessage(null)}>
            {parserMessage}
          </Alert>
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
            setParserMessage(null);
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
            setParserMessage(null);
          }}
          multiline
          minRows={8}
          fullWidth
        />
      </Stack>
    </Paper>
  );

  if (layout === "splitDescription") {
    return (
      <form id={formId} onSubmit={handleFormSubmit}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 2, md: 3 },
            alignItems: "start",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, minmax(0, 1fr))",
            },
          }}
        >
          <Box sx={{ gridColumn: { xs: "auto", md: "span 1" } }}>
            {parserSection}
          </Box>

          <Box sx={{ gridColumn: { xs: "auto", md: "span 2" } }}>
            <Box
              sx={{
                display: "grid",
                gap: { xs: 2, md: 3 },
                alignItems: "start",
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: "minmax(0, 1fr) minmax(0, 1fr)",
                },
                gridTemplateAreas: {
                  xs: '"main" "description" "actions"',
                  lg: '"main description" "actions actions"',
                },
              }}
            >
              <Stack spacing={2} sx={{ gridArea: "main" }}>
                {skuNotice}
                <Paper sx={{ p: 2 }}>
                  <Stack spacing={2}>{productFields}</Stack>
                </Paper>
                {variantSection}
                {photoSection}
              </Stack>

              <Paper
                sx={{
                  p: 2,
                  gridArea: "description",
                }}
              >
                <Stack spacing={2}>
                  <Typography variant="h6">產品描述</Typography>
                  <Box
                    sx={{
                      "& .MuiInputBase-root": { alignItems: "flex-start" },
                    }}
                  >
                    {descriptionField}
                  </Box>
                </Stack>
              </Paper>
            </Box>
          </Box>
        </Box>
      </form>
    );
  }

  return (
    <form id={formId} onSubmit={handleFormSubmit}>
      <Stack spacing={2}>
        {skuNotice}
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>{productFields}</Stack>
        </Paper>
        {variantSection}
        {photoSection}
        <Paper sx={{ p: 2 }}>{descriptionField}</Paper>
      </Stack>
    </form>
  );
}
