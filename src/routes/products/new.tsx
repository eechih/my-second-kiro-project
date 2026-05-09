import { PageHeader } from "@/components/PageHeader";
import { useCreateProduct, useCreateVariant } from "@/hooks/useProducts";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { validateProduct } from "@shared/logic/validation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ProductCreateForm,
  type ProductCreateFormValues,
} from "./-components/ProductCreateForm";

export const Route = createFileRoute("/products/new")({
  beforeLoad: requireAuth,
  component: ProductNewPage,
});

function ProductNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateProduct();
  const createVariantMutation = useCreateVariant();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (
    values: ProductCreateFormValues,
  ): Promise<void> => {
    setSubmitError(null);

    const validation = validateProduct({
      name: values.name,
      sku: values.sku,
      unitPrice: values.unitPrice,
      defaultCost: values.defaultCost,
    });
    if (!validation.valid) {
      setSubmitError(validation.error ?? "驗證失敗");
      return;
    }

    try {
      const product = await createMutation.mutateAsync(values);
      for (const variant of values.variants) {
        await createVariantMutation.mutateAsync({
          productId: product.id,
          variant,
        });
      }
      void navigate({ to: "/products/$productId", params: { productId: product.id } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "建立商品失敗");
    }
  };

  return (
    <Box sx={{ maxWidth: 800 }}>
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

      <ProductCreateForm
        isSubmitting={createMutation.isPending || createVariantMutation.isPending}
        onCancel={() => void navigate({ to: "/products" })}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
