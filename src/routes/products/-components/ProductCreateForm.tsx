import { FormField } from "@/components/FormField";
import { client } from "@/lib/amplify-client";
import { isTranslationSupplier } from "@shared/logic/translation-parser";
import { parseVariantLabels } from "@shared/logic/variant-labels";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { CreateVariantInput, Supplier } from "@shared/models";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";

export interface ProductCreateFormValues {
  name: string;
  sku: string;
  description: string;
  price: number;
  cost: number;
  stockQuantity: number;
  defaultSupplierId: string | null;
  variants: CreateVariantInput[];
}

export interface ProductCreateFormPrefill {
  name?: string;
  description?: string;
  price?: number;
  cost?: number;
  stockQuantity?: number;
  variantInput?: string;
  supplier?: Supplier | null;
}

export interface ProductCreateFormProps {
  isSubmitting: boolean;
  prefill?: ProductCreateFormPrefill | null;
  layout?: "default" | "splitDescription";
  onCancel: () => void;
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
  isSubmitting,
  prefill,
  layout = "default",
  onCancel,
  onSubmit,
}: ProductCreateFormProps): React.ReactElement {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [variantInput, setVariantInput] = useState("");
  const variantLabels = parseVariantLabels(variantInput);
  const suppliersQuery = useSupplierOptions();

  const form = useForm({
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      price: 0,
      cost: 0,
      stockQuantity: 0,
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
        variants: variantLabels.map((label) => ({
          label,
          priceOffset: null,
          costOffset: null,
        })),
      });
    },
  });

  useEffect(() => {
    if (!prefill) return;

    if (prefill.name !== undefined) {
      form.setFieldValue("name", prefill.name);
    }
    if (prefill.price !== undefined) {
      form.setFieldValue("price", prefill.price);
    }
    if (prefill.description !== undefined) {
      form.setFieldValue("description", prefill.description);
    }
    if (prefill.cost !== undefined) {
      form.setFieldValue("cost", prefill.cost);
    }
    if (prefill.stockQuantity !== undefined) {
      form.setFieldValue("stockQuantity", prefill.stockQuantity);
    }
    if (prefill.variantInput !== undefined) {
      setVariantInput(prefill.variantInput);
    }
    if (prefill.supplier !== undefined) {
      setSelectedSupplier(prefill.supplier);
    }
  }, [form, prefill]);

  const productFields = (
    <>
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

  const photoNotice = (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <InfoOutlinedIcon color="info" fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          商品照片可在建立商品後於編輯頁面管理。
        </Typography>
      </Box>
    </Paper>
  );

  const descriptionField = (
    <form.Field name="description">
      {(field) => (
        <FormField field={field} label="產品描述" multiline minRows={10} />
      )}
    </form.Field>
  );

  const formActions = (
    <Paper sx={{ p: 1.5 }}>
      <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
        <Button variant="outlined" onClick={onCancel}>
          取消
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
        >
          建立
        </Button>
      </Box>
    </Paper>
  );

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  if (layout === "splitDescription") {
    return (
      <form onSubmit={handleFormSubmit}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
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
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>{productFields}</Stack>
            </Paper>
            {variantSection}
            {photoNotice}
          </Stack>

          <Paper
            sx={{
              p: 2,
              gridArea: "description",
              alignSelf: { lg: "stretch" },
            }}
          >
            <Stack spacing={2} sx={{ height: { lg: "100%" } }}>
              <Typography variant="h6">產品描述</Typography>
              <Box
                sx={{
                  flex: { lg: 1 },
                  "& .MuiFormControl-root": { height: { lg: "100%" } },
                  "& .MuiInputBase-root": {
                    alignItems: "flex-start",
                    height: { lg: "100%" },
                  },
                  "& textarea": { height: { lg: "100% !important" } },
                }}
              >
                {descriptionField}
              </Box>
            </Stack>
          </Paper>

          <Box sx={{ gridArea: "actions" }}>{formActions}</Box>
        </Box>
      </form>
    );
  }

  return (
    <form onSubmit={handleFormSubmit}>
      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>{productFields}</Stack>
        </Paper>
        {variantSection}
        {photoNotice}
        <Paper sx={{ p: 2 }}>{descriptionField}</Paper>
        {formActions}
      </Stack>
    </form>
  );
}
