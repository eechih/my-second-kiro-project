import { PageHeader } from "@/components/PageHeader";
import { useCreateProduct } from "@/hooks/useProducts";
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
      await createMutation.mutateAsync(values);
      void navigate({ to: "/products" });
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
        isSubmitting={createMutation.isPending}
        onCancel={() => void navigate({ to: "/products" })}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
