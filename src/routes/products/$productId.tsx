import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import {
  useDeleteVariant,
  useGenerateVariants,
  useProduct,
  useUpdateProduct,
  useUpdateVariant,
} from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { validateProduct } from "@shared/logic/validation";
import type {
  SpecDimension,
  Supplier,
  UpdateVariantInput,
} from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ProductEditForm,
  type ProductEditFormValues,
} from "./-components/ProductEditForm";

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
  const generateVariantsMutation = useGenerateVariants();
  const updateVariantMutation = useUpdateVariant();
  const deleteVariantMutation = useDeleteVariant();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [specDimensions, setSpecDimensions] = useState<SpecDimension[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    variantId: string | null;
    variantLabel: string;
  }>({ open: false, variantId: null, variantLabel: "" });

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
              contactPerson: String(data.contactPerson ?? ""),
              phone: String(data.phone ?? ""),
              email: String(data.email ?? ""),
              address: String(data.address ?? ""),
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

  // Load spec dimensions from product
  useEffect(() => {
    if (product?.specDimensions) {
      setSpecDimensions(product.specDimensions);
    }
  }, [product?.specDimensions]);

  const handleSubmit = async (values: ProductEditFormValues): Promise<void> => {
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
      await updateMutation.mutateAsync({
        id: productId,
        name: values.name,
        sku: values.sku,
        unitPrice: values.unitPrice,
        defaultCost: values.defaultCost,
        defaultSupplierId: values.defaultSupplierId,
        stockQuantity: values.stockQuantity,
        specDimensions: values.specDimensions,
      });
      void navigate({ to: "/products" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "更新商品失敗");
    }
  };

  const handleUpdateVariant = (
    variantId: string,
    updates: UpdateVariantInput,
  ): void => {
    void updateVariantMutation.mutateAsync({
      productId,
      variantId,
      updates,
    });
  };

  const handleDeleteVariantClick = (variantId: string): void => {
    const variant = product?.variants.find((v) => v.id === variantId);
    setDeleteConfirm({
      open: true,
      variantId,
      variantLabel: variant?.label ?? "",
    });
  };

  const handleConfirmDeleteVariant = async (): Promise<void> => {
    if (!deleteConfirm.variantId) return;
    try {
      await deleteVariantMutation.mutateAsync({
        productId,
        variantId: deleteConfirm.variantId,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "刪除規格組合失敗");
    } finally {
      setDeleteConfirm({ open: false, variantId: null, variantLabel: "" });
    }
  };

  if (isLoadingProduct) {
    return (
      <Box sx={{ maxWidth: 800 }}>
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
      <Box sx={{ maxWidth: 800 }}>
        <Alert severity="error">
          {loadError instanceof Error ? loadError.message : "載入商品資料失敗"}
        </Alert>
      </Box>
    );
  }

  if (!product) {
    return (
      <Box sx={{ maxWidth: 800 }}>
        <Alert severity="warning">找不到該商品</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800 }}>
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

      <ProductEditForm
        product={product}
        productId={productId}
        selectedSupplier={selectedSupplier}
        specDimensions={specDimensions}
        isSubmitting={updateMutation.isPending}
        isGeneratingVariants={generateVariantsMutation.isPending}
        isVariantMutating={
          updateVariantMutation.isPending || deleteVariantMutation.isPending
        }
        onCancel={() => void navigate({ to: "/products" })}
        onSubmit={handleSubmit}
        onSupplierChange={setSelectedSupplier}
        onSpecDimensionsChange={setSpecDimensions}
        onGenerateVariants={(dimensions) => {
          void generateVariantsMutation.mutateAsync({
            productId,
            specDimensions: dimensions,
          });
        }}
        onUpdateVariant={handleUpdateVariant}
        onDeleteVariant={handleDeleteVariantClick}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        title="刪除規格組合"
        message={`確定要刪除規格組合「${deleteConfirm.variantLabel}」嗎？此操作無法復原。`}
        confirmLabel="刪除"
        confirmColor="error"
        onConfirm={() => void handleConfirmDeleteVariant()}
        onCancel={() =>
          setDeleteConfirm({ open: false, variantId: null, variantLabel: "" })
        }
      />
    </Box>
  );
}
