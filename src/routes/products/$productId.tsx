import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EntitySelect } from "@/components/EntitySelect";
import { FormField } from "@/components/FormField";
import { ImageUploader } from "@/components/ImageUploader";
import { VariantTable } from "@/components/VariantTable";
import {
  useDeleteVariant,
  useGenerateVariants,
  useProduct,
  useUpdateProduct,
  useUpdateVariant,
} from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import AddIcon from "@mui/icons-material/Add";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { validateProduct } from "@shared/logic/validation";
import type {
  SpecDimension,
  Supplier,
  UpdateVariantInput,
} from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useCallback, useEffect, useState } from "react";

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
  const [newDimensionName, setNewDimensionName] = useState("");
  const [newValueInputs, setNewValueInputs] = useState<Record<number, string>>(
    {},
  );
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

  const searchSuppliers = useCallback(async (query: string) => {
    const filter: Record<string, unknown> = {
      isActive: { eq: true },
    };
    if (query) {
      filter.or = [
        { name: { contains: query } },
        { contactPerson: { contains: query } },
      ];
    }
    const { data } = await client.models.Supplier.list({ filter, limit: 20 });
    return (data ?? []).map(
      (raw: Record<string, unknown>) =>
        ({
          id: String(raw.id ?? ""),
          name: String(raw.name ?? ""),
          contactPerson: String(raw.contactPerson ?? ""),
          phone: String(raw.phone ?? ""),
          email: String(raw.email ?? ""),
          address: String(raw.address ?? ""),
          isActive: raw.isActive !== false,
          createdAt: String(raw.createdAt ?? ""),
          updatedAt: String(raw.updatedAt ?? ""),
        }) as Supplier,
    );
  }, []);

  const form = useForm({
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      unitPrice: product?.unitPrice ?? 0,
      defaultCost: product?.defaultCost ?? 0,
      stockQuantity: product?.stockQuantity ?? 0,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      const validation = validateProduct({
        name: value.name,
        sku: value.sku,
        unitPrice: value.unitPrice,
        defaultCost: value.defaultCost,
      });
      if (!validation.valid) {
        setSubmitError(validation.error ?? "驗證失敗");
        return;
      }

      try {
        await updateMutation.mutateAsync({
          id: productId,
          name: value.name,
          sku: value.sku,
          unitPrice: value.unitPrice,
          defaultCost: value.defaultCost,
          defaultSupplierId: selectedSupplier?.id ?? null,
          stockQuantity: value.stockQuantity,
          specDimensions,
        });
        void navigate({ to: "/products" });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "更新商品失敗");
      }
    },
  });

  // --- Spec Dimensions Management ---

  const handleAddDimension = (): void => {
    const trimmed = newDimensionName.trim();
    if (!trimmed) return;
    if (specDimensions.some((d) => d.name === trimmed)) return;
    setSpecDimensions([...specDimensions, { name: trimmed, values: [] }]);
    setNewDimensionName("");
  };

  const handleRemoveDimension = (index: number): void => {
    setSpecDimensions(specDimensions.filter((_, i) => i !== index));
    const newInputs = { ...newValueInputs };
    delete newInputs[index];
    setNewValueInputs(newInputs);
  };

  const handleAddValue = (dimIndex: number): void => {
    const value = (newValueInputs[dimIndex] ?? "").trim();
    if (!value) return;
    const dim = specDimensions[dimIndex];
    if (!dim || dim.values.includes(value)) return;
    const updated = [...specDimensions];
    updated[dimIndex] = { ...dim, values: [...dim.values, value] };
    setSpecDimensions(updated);
    setNewValueInputs({ ...newValueInputs, [dimIndex]: "" });
  };

  const handleRemoveValue = (dimIndex: number, valueIndex: number): void => {
    const dim = specDimensions[dimIndex];
    if (!dim) return;
    const updated = [...specDimensions];
    updated[dimIndex] = {
      ...dim,
      values: dim.values.filter((_, i) => i !== valueIndex),
    };
    setSpecDimensions(updated);
  };

  const handleGenerateVariants = async (): Promise<void> => {
    setSubmitError(null);
    try {
      await generateVariantsMutation.mutateAsync({
        productId,
        specDimensions,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "產生規格組合失敗");
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
      <Typography variant="h4" gutterBottom>
        編輯商品
      </Typography>

      {submitError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setSubmitError(null)}
        >
          {submitError}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
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
                  // Skip check if SKU hasn't changed
                  if (value.trim() === product.sku) return undefined;
                  const { data } = await client.models.Product.list({
                    filter: { sku: { eq: value.trim() } },
                    limit: 1,
                  });
                  if (data && data.length > 0) {
                    return "此 SKU 已存在，請使用其他 SKU";
                  }
                  return undefined;
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

            {/* Only show stock quantity field if product has no variants */}
            {product.variants.length === 0 && (
              <form.Field name="stockQuantity">
                {(field) => (
                  <FormField field={field} label="庫存數量" type="number" />
                )}
              </form.Field>
            )}

            {/* 供應商選取 */}
            <EntitySelect<Supplier>
              label="預設供應商"
              value={selectedSupplier}
              onChange={setSelectedSupplier}
              searchFn={searchSuppliers}
              getOptionLabel={(s) => s.name}
            />

            {/* 規格維度定義區塊 */}
            <Divider />
            <Typography variant="h6">規格維度定義</Typography>
            <Typography variant="body2" color="text.secondary">
              定義商品的規格維度（如顏色、尺寸），變更後點擊「產生規格組合」按鈕自動產生笛卡爾積。
            </Typography>

            {specDimensions.map((dim, dimIndex) => (
              <Paper key={dimIndex} variant="outlined" sx={{ p: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {dim.name}
                  </Typography>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemoveDimension(dimIndex)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Box
                  sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}
                >
                  {dim.values.map((val, valIndex) => (
                    <Chip
                      key={valIndex}
                      label={val}
                      size="small"
                      onDelete={() => handleRemoveValue(dimIndex, valIndex)}
                    />
                  ))}
                </Box>

                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="新增選項值"
                    value={newValueInputs[dimIndex] ?? ""}
                    onChange={(e) =>
                      setNewValueInputs({
                        ...newValueInputs,
                        [dimIndex]: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddValue(dimIndex);
                      }
                    }}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleAddValue(dimIndex)}
                  >
                    新增
                  </Button>
                </Box>
              </Paper>
            ))}

            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                placeholder="維度名稱（如：顏色、尺寸）"
                value={newDimensionName}
                onChange={(e) => setNewDimensionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddDimension();
                  }
                }}
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddDimension}
                disabled={!newDimensionName.trim()}
              >
                新增維度
              </Button>
            </Box>

            {specDimensions.length > 0 &&
              specDimensions.some((d) => d.values.length > 0) && (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={
                    generateVariantsMutation.isPending ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <AutoFixHighIcon />
                    )
                  }
                  onClick={() => void handleGenerateVariants()}
                  disabled={generateVariantsMutation.isPending}
                >
                  產生規格組合
                </Button>
              )}

            {/* 規格組合表格 */}
            {product.variants.length > 0 && (
              <>
                <Divider />
                <Typography variant="h6">規格組合</Typography>
                <VariantTable
                  productId={productId}
                  variants={product.variants}
                  defaultUnitPrice={product.unitPrice}
                  defaultCost={product.defaultCost}
                  onUpdateVariant={handleUpdateVariant}
                  onDeleteVariant={handleDeleteVariantClick}
                  isLoading={
                    updateVariantMutation.isPending ||
                    deleteVariantMutation.isPending
                  }
                />
              </>
            )}

            {/* 商品照片 */}
            <Divider />
            <Typography variant="h6">商品照片</Typography>
            <Typography variant="body2" color="text.secondary">
              上傳商品照片，系統會自動壓縮圖片並產生縮圖。點擊照片可檢視原圖。
            </Typography>
            <ImageUploader
              productId={productId}
              imageKeys={product.imageUrls ?? []}
            />

            <Divider />

            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                onClick={() => void navigate({ to: "/products" })}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={updateMutation.isPending}
                startIcon={
                  updateMutation.isPending ? (
                    <CircularProgress size={16} />
                  ) : undefined
                }
              >
                儲存
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>

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
