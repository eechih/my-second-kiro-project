import { PageHeader } from "@/components/PageHeader";
import { useUploadProductImagesBatch } from "@/hooks/useProductImages";
import { useCreateProduct, useSyncProductOptions } from "@/hooks/useProducts";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { validateProduct } from "@shared/logic/validation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProductCreateActions } from "./-components/ProductCreateActions";
import {
  ProductCreateForm,
  type ProductCreateFormValues,
} from "./-components/ProductCreateForm";

export const Route = createFileRoute("/products/new")({
  beforeLoad: requireAuth,
  component: ProductNewPage,
});

const productCreateFormId = "product-create-form";

function ProductNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateProduct();
  const syncProductOptionsMutation = useSyncProductOptions();
  const uploadImagesMutation = useUploadProductImagesBatch();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formResetToken, setFormResetToken] = useState(0);

  const handleSubmit = async (
    values: ProductCreateFormValues,
  ): Promise<void> => {
    setSubmitError(null);
    setSubmitSuccess(false);

    const validation = validateProduct({
      name: values.name,
      price: values.price,
      cost: values.cost,
    });
    if (!validation.valid) {
      setSubmitError(validation.error ?? "驗證失敗");
      return;
    }

    try {
      const product = await createMutation.mutateAsync(values);
      await syncProductOptionsMutation.mutateAsync({
        productId: product.id,
        options: values.options,
      });
      await uploadImagesMutation.mutateAsync({
        productId: product.id,
        files: values.imageFiles,
      });
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "建立商品失敗");
    }
  };

  const handleContinueCreate = (): void => {
    setSubmitSuccess(false);
    setSubmitError(null);
    setFormResetToken((prev) => prev + 1);
  };

  return (
    <Box>
      <PageHeader section="商品" current="新增" title="新增商品" />

      {submitError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setSubmitError(null)}
        >
          {submitError}
        </Alert>
      )}

      {submitSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                size="small"
                onClick={() => void navigate({ to: "/products" })}
              >
                前往商品列表
              </Button>
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                onClick={handleContinueCreate}
              >
                繼續新增
              </Button>
            </Stack>
          }
        >
          商品已新增完成。
        </Alert>
      )}

      {!submitSuccess && (
        <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}>
          <ProductCreateActions
            formId={productCreateFormId}
            isSubmitting={
              createMutation.isPending ||
              syncProductOptionsMutation.isPending ||
              uploadImagesMutation.isPending
            }
            onCancel={() => void navigate({ to: "/products" })}
          />
        </Box>
      )}

      <Stack spacing={3}>
        <ProductCreateForm
          formId={productCreateFormId}
          layout="splitDescription"
          resetToken={formResetToken}
          onSubmit={handleSubmit}
        />
      </Stack>
    </Box>
  );
}
