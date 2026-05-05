import { useState, useCallback } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { FormField } from "@/components/FormField";
import { EntitySelect } from "@/components/EntitySelect";
import { useCreateProduct } from "@/hooks/useProducts";
import { validateProduct } from "@shared/logic/validation";
import { client } from "@/lib/amplify-client";
import type { Supplier, SpecDimension } from "@shared/models";

export const Route = createFileRoute("/products/new")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: ProductNewPage,
});

function ProductNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateProduct();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [specDimensions, setSpecDimensions] = useState<SpecDimension[]>([]);
  const [newDimensionName, setNewDimensionName] = useState("");
  const [newValueInputs, setNewValueInputs] = useState<Record<number, string>>(
    {},
  );

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
      name: "",
      sku: "",
      unitPrice: 0,
      defaultCost: 0,
      stockQuantity: 0,
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
        await createMutation.mutateAsync({
          name: value.name,
          sku: value.sku,
          unitPrice: value.unitPrice,
          defaultCost: value.defaultCost,
          defaultSupplierId: selectedSupplier?.id ?? null,
          stockQuantity: value.stockQuantity,
          specDimensions:
            specDimensions.length > 0 ? specDimensions : undefined,
        });
        void navigate({ to: "/products" });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "建立商品失敗");
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

  return (
    <Box maxWidth={800}>
      <Typography variant="h4" gutterBottom>
        新增商品
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

            <form.Field name="stockQuantity">
              {(field) => (
                <FormField field={field} label="初始庫存數量" type="number" />
              )}
            </form.Field>

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
              定義商品的規格維度（如顏色、尺寸），建立商品後可產生規格組合。
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
                  <Typography variant="subtitle1" fontWeight={600}>
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

            <Divider />

            {/* 商品照片提示 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <InfoOutlinedIcon color="info" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                商品照片可在建立商品後於編輯頁面上傳。
              </Typography>
            </Box>

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
                disabled={createMutation.isPending}
                startIcon={
                  createMutation.isPending ? (
                    <CircularProgress size={16} />
                  ) : undefined
                }
              >
                建立
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
