import { EntitySelect } from "@/components/EntitySelect";
import { FormField } from "@/components/FormField";
import { ImageUploader } from "@/components/ImageUploader";
import { VariantTable } from "@/components/VariantTable";
import { client } from "@/lib/amplify-client";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type {
  CreateVariantInput,
  Product,
  Supplier,
  UpdateVariantInput,
} from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { useCallback, useEffect, useState } from "react";

export interface ProductEditFormValues {
  name: string;
  sku: string;
  unitPrice: number;
  defaultCost: number;
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
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
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
    stockQuantity: "0",
    price: "",
    cost: "",
  });
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
      name: product.name,
      sku: product.sku,
      unitPrice: product.unitPrice,
      defaultCost: product.defaultCost,
      stockQuantity: product.stockQuantity,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        name: value.name,
        sku: value.sku,
        unitPrice: value.unitPrice,
        defaultCost: value.defaultCost,
        stockQuantity: value.stockQuantity,
        defaultSupplierId: selectedSupplier?.id ?? null,
      });
    },
  });

  useEffect(() => {
    form.reset({
      name: product.name,
      sku: product.sku,
      unitPrice: product.unitPrice,
      defaultCost: product.defaultCost,
      stockQuantity: product.stockQuantity,
    });
  }, [form, product]);

  const handleCreateVariant = (): void => {
    const label = newVariant.label.trim();
    if (!label) return;

    const stockQuantity = Number(newVariant.stockQuantity);
    const price = newVariant.price === "" ? null : Number(newVariant.price);
    const cost = newVariant.cost === "" ? null : Number(newVariant.cost);

    onCreateVariant({
      label,
      stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
      price: price !== null && Number.isFinite(price) ? price : null,
      cost: cost !== null && Number.isFinite(cost) ? cost : null,
    });
    setNewVariant({
      label: "",
      stockQuantity: "0",
      price: "",
      cost: "",
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
              onBlur: ({ value }) =>
                !value.trim() ? "SKU 為必填" : undefined,
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

          {product.variants.length === 0 && (
            <form.Field name="stockQuantity">
              {(field) => (
                <FormField field={field} label="庫存數量" type="number" />
              )}
            </form.Field>
          )}

          <EntitySelect<Supplier>
            label="預設供應商"
            value={selectedSupplier}
            onChange={onSupplierChange}
            searchFn={searchSuppliers}
            getOptionLabel={(supplier) => supplier.name}
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
                  md: "2fr 1fr 1fr 1fr auto",
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
                label="庫存"
                size="small"
                type="number"
                value={newVariant.stockQuantity}
                onChange={(event) =>
                  setNewVariant({
                    ...newVariant,
                    stockQuantity: event.target.value,
                  })
                }
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <TextField
                label="單價"
                size="small"
                type="number"
                value={newVariant.price}
                onChange={(event) =>
                  setNewVariant({ ...newVariant, price: event.target.value })
                }
                placeholder={String(product.unitPrice)}
                slotProps={{ htmlInput: { min: 0, step: "any" } }}
              />
              <TextField
                label="成本"
                size="small"
                type="number"
                value={newVariant.cost}
                onChange={(event) =>
                  setNewVariant({ ...newVariant, cost: event.target.value })
                }
                placeholder={String(product.defaultCost)}
                slotProps={{ htmlInput: { min: 0, step: "any" } }}
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
            defaultUnitPrice={product.unitPrice}
            defaultCost={product.defaultCost}
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
