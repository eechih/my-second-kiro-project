import { FormField } from "@/components/FormField";
import { ImageUploader } from "@/components/ImageUploader";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type {
  CreateProductOptionInput,
  Product,
  Supplier,
} from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
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

export interface ProductEditFormValues {
  name: string;
  description: string;
  price: number;
  cost: number;
  stockQuantity: number;
  defaultSupplierId: string | null;
  options: CreateProductOptionInput[];
}

export interface ProductEditFormProps {
  product: Product;
  productId: string;
  selectedSupplier: Supplier | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ProductEditFormValues) => Promise<void>;
  onSupplierChange: (supplier: Supplier | null) => void;
}

function mapProductToEditableOptions(product: Product): EditableProductOption[] {
  if (product.options.length > 0) {
    return product.options.map((option) => ({
      name: option.name,
      values: option.values.map((value) => ({
        name: value.name,
        priceOffset: value.priceOffset,
        costOffset: value.costOffset,
      })),
    }));
  }

  if (product.variants.length > 0) {
    return [
      {
        name: "規格",
        values: product.variants.map((variant) => ({
          name: variant.label,
          priceOffset: variant.priceOffset ?? 0,
          costOffset: variant.costOffset ?? 0,
        })),
      },
    ];
  }

  return [];
}

export function ProductEditForm({
  product,
  productId,
  selectedSupplier,
  isSubmitting,
  onCancel,
  onSubmit,
  onSupplierChange,
}: ProductEditFormProps): React.ReactElement {
  const [options, setOptions] = useState<EditableProductOption[]>(
    mapProductToEditableOptions(product),
  );
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
        options: mapEditableOptionsToCreateInput(options),
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
    setOptions(mapProductToEditableOptions(product));
  }, [form, product]);

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
          title="規格設定"
          description="定義規格名稱與每個規格值的加價、成本增加。系統會同步產生舊版規格組合供訂單流程使用。"
        >
          <ProductOptionEditor value={options} onChange={setOptions} />
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
