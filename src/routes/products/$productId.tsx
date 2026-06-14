import { PageHeader } from "@/components/PageHeader";
import {
  useProduct,
  useSyncProductOptions,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { validateProduct } from "@shared/logic/validation";
import type { Supplier } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ProductEditForm,
  type ProductEditFormValues,
} from "./-components/ProductEditForm";
import { ProductProcurementPanel } from "./-components/ProductProcurementPanel";

export const Route = createFileRoute("/products/$productId")({
  beforeLoad: requireAuth,
  component: ProductEditPage,
});

function ProductEditPage() {
  const navigate = useNavigate();
  const { productId } = Route.useParams();
  const {
    data: product,
    isLoading: isLoadingProduct,
    error: loadError,
  } = useProduct(productId);
  const updateMutation = useUpdateProduct();
  const syncProductOptionsMutation = useSyncProductOptions();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  // Load supplier when product data is available
  useEffect(() => {
    if (product?.defaultSupplierId) {
      void (async () => {
        try {
          const { data } = await client.models.Supplier.get({
            id: product.defaultSupplierId!,
          });
          if (data) {
            setSelectedSupplier({
              id: String(data.id ?? ""),
              name: String(data.name ?? ""),
              phone: String(data.phone ?? ""),
              email: String(data.email ?? ""),
              address: String(data.address ?? ""),
              translationParser: null,
              isActive: data.isActive !== false,
              createdAt: String(data.createdAt ?? ""),
              updatedAt: String(data.updatedAt ?? ""),
            });
          }
        } catch {
          // Supplier may have been deleted
        }
      })();
    }
  }, [product?.defaultSupplierId]);

  const handleSubmit = async (values: ProductEditFormValues): Promise<void> => {
    setSubmitError(null);

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
      await updateMutation.mutateAsync({
        id: productId,
        name: values.name,
        description: values.description,
        price: values.price,
        cost: values.cost,
        defaultSupplierId: values.defaultSupplierId,
        stockQuantity: values.stockQuantity,
      });
      await syncProductOptionsMutation.mutateAsync({
        productId,
        options: values.options,
      });
      void navigate({ to: "/products" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "更新商品失敗");
    }
  };

  if (isLoadingProduct) {
    return (
      <Box sx={{ maxWidth: 1040 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Paper sx={{ p: 3 }}>
          <Stack spacing={3}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={56} />
            ))}
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box sx={{ maxWidth: 1040 }}>
        <Alert severity="error">
          {loadError instanceof Error ? loadError.message : "載入商品資料失敗"}
        </Alert>
      </Box>
    );
  }

  if (!product) {
    return (
      <Box sx={{ maxWidth: 1040 }}>
        <Alert severity="warning">找不到該商品</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200 }}>
      <PageHeader section="商品" current="編輯" title="編輯商品" />

      {submitError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setSubmitError(null)}
        >
          {submitError}
        </Alert>
      )}

      <Stack spacing={3}>
        <ProductEditForm
          product={product}
          productId={productId}
          selectedSupplier={selectedSupplier}
          isSubmitting={
            updateMutation.isPending || syncProductOptionsMutation.isPending
          }
          onCancel={() => void navigate({ to: "/products" })}
          onSubmit={handleSubmit}
          onSupplierChange={setSelectedSupplier}
        />

        <ProductProcurementPanel product={product} />
      </Stack>
    </Box>
  );
}
