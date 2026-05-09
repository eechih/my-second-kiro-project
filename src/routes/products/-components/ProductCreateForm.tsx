import { EntitySelect } from "@/components/EntitySelect";
import { FormField } from "@/components/FormField";
import { client } from "@/lib/amplify-client";
import { parseVariantLabels } from "@shared/logic/variant-labels";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { CreateVariantInput, Supplier } from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { useCallback, useState } from "react";

export interface ProductCreateFormValues {
  name: string;
  sku: string;
  unitPrice: number;
  defaultCost: number;
  stockQuantity: number;
  defaultSupplierId: string | null;
  variants: CreateVariantInput[];
}

export interface ProductCreateFormProps {
  isSubmitting: boolean;
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
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

export function ProductCreateForm({
  isSubmitting,
  onCancel,
  onSubmit,
}: ProductCreateFormProps): React.ReactElement {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [variantInput, setVariantInput] = useState("");
  const variantLabels = parseVariantLabels(variantInput);

  const searchSuppliers = useCallback(async (query: string) => {
    const filter: Record<string, unknown> = { isActive: { eq: true } };
    if (query) {
      filter.or = [
        { name: { contains: query } },
        { contactPerson: { contains: query } },
      ];
    }
    const { data } = await client.models.Supplier.list({ filter, limit: 20 });
    return (data ?? []).map((raw) =>
      mapSupplier(raw as unknown as Record<string, unknown>),
    );
  }, []);

  const form = useForm({
    defaultValues: {
      name: "",
      sku: "",
      unitPrice: 0,
      defaultCost: 0,
      stockQuantity: 0,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        name: value.name,
        sku: value.sku,
        unitPrice: value.unitPrice,
        defaultCost: value.defaultCost,
        stockQuantity: value.stockQuantity,
        defaultSupplierId: selectedSupplier?.id ?? null,
        variants: variantLabels.map((label) => ({
          label,
          price: value.unitPrice,
          cost: value.defaultCost,
        })),
      });
    },
  });

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
              onBlur: ({ value }) =>
                !value.trim() ? "SKU 為必填" : undefined,
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
            name="unitPrice"
            validators={{
              onBlur: ({ value }) =>
                value < 0 ? "單價不可為負數" : undefined,
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
            name="defaultCost"
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

          <EntitySelect<Supplier>
            label="預設供應商"
            value={selectedSupplier}
            onChange={setSelectedSupplier}
            searchFn={searchSuppliers}
            getOptionLabel={(supplier) => supplier.name}
          />

          <Divider />

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

          <Divider />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <InfoOutlinedIcon color="info" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              商品照片可在建立商品後於編輯頁面管理。
            </Typography>
          </Box>

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
              建立
            </Button>
          </Box>
        </Stack>
      </form>
    </Paper>
  );
}
