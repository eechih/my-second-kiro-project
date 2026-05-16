import { FormField } from "@/components/FormField";
import { ImageUploader } from "@/components/ImageUploader";
import { VariantTable } from "@/components/VariantTable";
import { client } from "@/lib/amplify-client";
import { isTranslationSupplier } from "@shared/logic/translation-parser";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type {
  CreateVariantInput,
  Product,
  Supplier,
  UpdateVariantInput,
} from "@shared/models";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";

export interface ProductEditFormValues {
  name: string;
  sku: string;
  description: string;
  price: number;
  cost: number;
  stockQuantity: number;
  defaultSupplierId: string | null;
}

export interface ProductEditFormProps {
  product: Product;
  productId: string;
  selectedSupplier: Supplier | null;
  isSubmitting: boolean;
  isVariantMutating: boolean;
  onCancel: () => void;
  onSubmit: (values: ProductEditFormValues) => Promise<void>;
  onSupplierChange: (supplier: Supplier | null) => void;
  onCreateVariant: (variant: CreateVariantInput) => void;
  onUpdateVariant: (variantId: string, updates: UpdateVariantInput) => void;
  onDeleteVariant: (variantId: string) => void;
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

export function ProductEditForm({
  product,
  productId,
  selectedSupplier,
  isSubmitting,
  isVariantMutating,
  onCancel,
  onSubmit,
  onSupplierChange,
  onCreateVariant,
  onUpdateVariant,
  onDeleteVariant,
}: ProductEditFormProps): React.ReactElement {
  const [newVariant, setNewVariant] = useState({
    label: "",
    priceOffset: "",
    costOffset: "",
  });
  const suppliersQuery = useSupplierOptions();

  const form = useForm({
    defaultValues: {
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: product.price,
      cost: product.cost,
      stockQuantity: product.stockQuantity,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        name: value.name,
        sku: value.sku,
        description: value.description,
        price: Math.trunc(value.price),
        cost: Math.trunc(value.cost),
        stockQuantity: value.stockQuantity,
        defaultSupplierId: selectedSupplier?.id ?? null,
      });
    },
  });

  useEffect(() => {
    form.reset({
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: product.price,
      cost: product.cost,
      stockQuantity: product.stockQuantity,
    });
  }, [form, product]);

  const handleCreateVariant = (): void => {
    const label = newVariant.label.trim();
    if (!label) return;

    const priceOffset =
      newVariant.priceOffset === ""
        ? null
        : Math.trunc(Number(newVariant.priceOffset));
    const costOffset =
      newVariant.costOffset === ""
        ? null
        : Math.trunc(Number(newVariant.costOffset));

    onCreateVariant({
      label,
      priceOffset:
        priceOffset !== null && Number.isFinite(priceOffset)
          ? priceOffset
          : null,
      costOffset:
        costOffset !== null && Number.isFinite(costOffset) ? costOffset : null,
    });
    setNewVariant({
      label: "",
      priceOffset: "",
      costOffset: "",
    });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <Stack spacing={3}>
          <form.Field
            name="name"
            validators={{
              onBlur: ({ value }) =>
                !value.trim() ? "商品名稱為必填" : undefined,
            }}
          >
            {(field) => <FormField field={field} label="商品名稱" required />}
          </form.Field>

          <form.Field
            name="sku"
            validators={{
              onBlur: ({ value }) => (!value.trim() ? "SKU 為必填" : undefined),
              onBlurAsync: async ({ value }) => {
                if (!value.trim()) return undefined;
                if (value.trim() === product.sku) return undefined;
                const { data } = await client.models.Product.list({
                  filter: { sku: { eq: value.trim() } },
                  limit: 1,
                });
                return data && data.length > 0
                  ? "此 SKU 已存在，請使用其他 SKU"
                  : undefined;
              },
            }}
          >
            {(field) => (
              <Box sx={{ position: "relative" }}>
                <FormField field={field} label="SKU" required />
                {field.state.meta.isValidating && (
                  <CircularProgress
                    size={20}
                    sx={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  />
                )}
              </Box>
            )}
          </form.Field>

          <form.Field
            name="price"
            validators={{
              onBlur: ({ value }) => (value < 0 ? "單價不可為負數" : undefined),
            }}
          >
            {(field) => (
              <FormField
                field={field}
                label="預設單價"
                type="number"
                required
              />
            )}
          </form.Field>

          <form.Field
            name="cost"
            validators={{
              onBlur: ({ value }) =>
                value < 0 ? "進貨成本不可為負數" : undefined,
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
              <FormField field={field} label="庫存數量" type="number" />
            )}
          </form.Field>

          <SupplierSelect
            label="預設供應商"
            value={selectedSupplier}
            onChange={onSupplierChange}
            suppliers={suppliersQuery.data ?? []}
            isLoading={suppliersQuery.isLoading}
            isFetching={suppliersQuery.isFetching}
            error={suppliersQuery.error}
          />

          <Divider />
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="h6">規格選項</Typography>
              <Typography variant="body2" color="text.secondary">
                每個規格以單一標籤管理，例如「黑色」或「XL」。
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "2fr 1fr 1fr auto",
                },
              }}
            >
              <TextField
                label="規格標籤"
                size="small"
                value={newVariant.label}
                onChange={(event) =>
                  setNewVariant({ ...newVariant, label: event.target.value })
                }
                required
              />
              <TextField
                label="單價偏移"
                size="small"
                type="number"
                value={newVariant.priceOffset}
                onChange={(event) =>
                  setNewVariant({
                    ...newVariant,
                    priceOffset: event.target.value,
                  })
                }
                placeholder="0"
                slotProps={{ htmlInput: { step: 1 } }}
              />
              <TextField
                label="成本偏移"
                size="small"
                type="number"
                value={newVariant.costOffset}
                onChange={(event) =>
                  setNewVariant({
                    ...newVariant,
                    costOffset: event.target.value,
                  })
                }
                placeholder="0"
                slotProps={{ htmlInput: { step: 1 } }}
              />
              <Button
                type="button"
                variant="outlined"
                startIcon={<AddIcon />}
                disabled={isVariantMutating || !newVariant.label.trim()}
                onClick={handleCreateVariant}
                sx={{ minWidth: 96 }}
              >
                新增
              </Button>
            </Box>
          </Stack>

          <VariantTable
            productId={productId}
            variants={product.variants}
            defaultUnitPrice={product.price}
            defaultCost={product.cost}
            onUpdateVariant={onUpdateVariant}
            onDeleteVariant={onDeleteVariant}
            isLoading={isVariantMutating}
          />

          <Divider />
          <Typography variant="h6">商品照片</Typography>
          <Typography variant="body2" color="text.secondary">
            上傳商品照片，系統會自動壓縮圖片並產生縮圖。點擊照片可檢視原圖。
          </Typography>
          <ImageUploader productId={productId} imageKeys={product.imageUrls} />

          <form.Field name="description">
            {(field) => (
              <FormField
                field={field}
                label="產品描述"
                multiline
                minRows={4}
              />
            )}
          </form.Field>

          <Divider />

          <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={onCancel}>
              取消
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? <CircularProgress size={16} /> : undefined
              }
            >
              儲存
            </Button>
          </Box>
        </Stack>
      </form>
    </Paper>
  );
}
