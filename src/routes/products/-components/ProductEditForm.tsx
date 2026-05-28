import { FormField } from "@/components/FormField";
import { ImageUploader } from "@/components/ImageUploader";
import { VariantTable } from "@/components/VariantTable";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type {
  CreateVariantInput,
  Product,
  Supplier,
  UpdateVariantInput,
} from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import {
  ProductFormSection,
  SupplierSelect,
  useSupplierOptions,
} from "./ProductFormShared";

export interface ProductEditFormValues {
  name: string;
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
      description: product.description,
      price: product.price,
      cost: product.cost,
      stockQuantity: product.stockQuantity,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        name: value.name,
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
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <Stack spacing={2.5}>
        <ProductFormSection title="基本資料">
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(0, 1.4fr) minmax(220px, 0.8fr)",
              },
            }}
          >
            <form.Field
              name="name"
              validators={{
                onBlur: ({ value }) =>
                  !value.trim() ? "商品名稱為必填" : undefined,
              }}
            >
              {(field) => <FormField field={field} label="商品名稱" required />}
            </form.Field>

            <TextField
              label="SKU"
              value={product.sku}
              disabled
              helperText="系統產生的流水號，建立後不可修改。"
            />

            <form.Field
              name="price"
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

            <form.Field
              name="stockQuantity"
              validators={{
                onBlur: ({ value }) =>
                  value < 0 ? "庫存數量不可為負數" : undefined,
              }}
            >
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
          </Box>
        </ProductFormSection>

        <ProductFormSection
          title="規格選項"
          description="每個規格以單一標籤管理，例如「黑色」或「XL」。"
        >
          <Stack spacing={2}>
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

            <VariantTable
              productId={productId}
              variants={product.variants}
              defaultUnitPrice={product.price}
              defaultCost={product.cost}
              onUpdateVariant={onUpdateVariant}
              onDeleteVariant={onDeleteVariant}
              isLoading={isVariantMutating}
            />
          </Stack>
        </ProductFormSection>

        <ProductFormSection
          title="商品照片"
          description="上傳商品照片，系統會自動壓縮圖片並產生縮圖。點擊照片可檢視原圖。"
        >
          <ImageUploader productId={productId} imageKeys={product.imageUrls} />
        </ProductFormSection>

        <ProductFormSection title="產品描述">
          <form.Field name="description">
            {(field) => (
              <FormField
                field={field}
                label="產品描述"
                multiline
                minRows={5}
              />
            )}
          </form.Field>
        </ProductFormSection>

        <Paper sx={{ p: 1.5 }}>
          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={onCancel}>
              取消
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? <CircularProgress size={16} /> : <SaveIcon />
              }
            >
              儲存
            </Button>
          </Box>
        </Paper>
      </Stack>
    </form>
  );
}
