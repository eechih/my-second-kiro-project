import { EntitySelect } from "@/components/EntitySelect";
import { FormField } from "@/components/FormField";
import { client } from "@/lib/amplify-client";
import { parseVariantLabels } from "@shared/logic/variant-labels";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { CreateVariantInput, Supplier } from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { useCallback, useState } from "react";

export interface ProductCreateFormValues {
  name: string;
  sku: string;
  unitPrice: number;
  defaultCost: number;
  stockQuantity: number;
  defaultSupplierId: string | null;
  variants: CreateVariantInput[];
}

export interface ProductCreateFormProps {
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ProductCreateFormValues) => Promise<void>;
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

export function ProductCreateForm({
  isSubmitting,
  onCancel,
  onSubmit,
}: ProductCreateFormProps): React.ReactElement {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [variantInput, setVariantInput] = useState("");
  const [variantMode, setVariantMode] = useState<"quick" | "standard">(
    "quick",
  );
  const [variantDrafts, setVariantDrafts] = useState<CreateVariantInput[]>([]);
  const [standardVariant, setStandardVariant] = useState({
    label: "",
    sku: "",
    stockQuantity: "0",
    price: "",
    cost: "",
  });
  const variantLabels = parseVariantLabels(variantInput);

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
      name: "",
      sku: "",
      unitPrice: 0,
      defaultCost: 0,
      stockQuantity: 0,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        name: value.name,
        sku: value.sku,
        unitPrice: value.unitPrice,
        defaultCost: value.defaultCost,
        stockQuantity: value.stockQuantity,
        defaultSupplierId: selectedSupplier?.id ?? null,
        variants:
          variantMode === "quick"
            ? variantLabels.map((label) => ({
                label,
                stockQuantity: 0,
                price: value.unitPrice,
                cost: value.defaultCost,
              }))
            : variantDrafts,
      });
    },
  });

  const handleAddStandardVariant = (): void => {
    const label = standardVariant.label.trim();
    if (!label) return;

    const stockQuantity = Number(standardVariant.stockQuantity);
    const price =
      standardVariant.price === "" ? null : Number(standardVariant.price);
    const cost =
      standardVariant.cost === "" ? null : Number(standardVariant.cost);

    setVariantDrafts((previous) => [
      ...previous,
      {
        label,
        sku: standardVariant.sku.trim() || undefined,
        stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
        price: price !== null && Number.isFinite(price) ? price : null,
        cost: cost !== null && Number.isFinite(cost) ? cost : null,
      },
    ]);
    setStandardVariant({
      label: "",
      sku: "",
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

          <form.Field name="stockQuantity">
            {(field) => (
              <FormField field={field} label="初始庫存數量" type="number" />
            )}
          </form.Field>

          <EntitySelect<Supplier>
            label="預設供應商"
            value={selectedSupplier}
            onChange={setSelectedSupplier}
            searchFn={searchSuppliers}
            getOptionLabel={(supplier) => supplier.name}
          />

          <Divider />

          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
              <Typography variant="h6">規格定義</Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={variantMode}
                onChange={(_event, value: "quick" | "standard" | null) => {
                  if (value) setVariantMode(value);
                }}
              >
                <ToggleButton value="quick">快速</ToggleButton>
                <ToggleButton value="standard">標準</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {variantMode === "quick" ? (
              <>
                <TextField
                  label="規格選項"
                  value={variantInput}
                  onChange={(event) => setVariantInput(event.target.value)}
                  placeholder="[黑，白，藍/M，L，XL，2L，3L]"
                  helperText="使用 / 分隔規格層級，使用逗號分隔選項；快速模式會帶入產品預設單價與預設成本。"
                />
                {variantLabels.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {variantLabels.map((label) => (
                      <Chip key={label} label={label} size="small" />
                    ))}
                  </Box>
                )}
              </>
            ) : (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "2fr 1.4fr 1fr 1fr 1fr auto",
                    },
                  }}
                >
                  <TextField
                    label="規格標籤"
                    size="small"
                    value={standardVariant.label}
                    onChange={(event) =>
                      setStandardVariant({
                        ...standardVariant,
                        label: event.target.value,
                      })
                    }
                    required
                  />
                  <TextField
                    label="SKU"
                    size="small"
                    value={standardVariant.sku}
                    onChange={(event) =>
                      setStandardVariant({
                        ...standardVariant,
                        sku: event.target.value,
                      })
                    }
                    placeholder="留空自動產生"
                  />
                  <TextField
                    label="庫存"
                    size="small"
                    type="number"
                    value={standardVariant.stockQuantity}
                    onChange={(event) =>
                      setStandardVariant({
                        ...standardVariant,
                        stockQuantity: event.target.value,
                      })
                    }
                    slotProps={{ htmlInput: { min: 0 } }}
                  />
                  <TextField
                    label="單價"
                    size="small"
                    type="number"
                    value={standardVariant.price}
                    onChange={(event) =>
                      setStandardVariant({
                        ...standardVariant,
                        price: event.target.value,
                      })
                    }
                    placeholder="沿用預設"
                    slotProps={{ htmlInput: { min: 0, step: "any" } }}
                  />
                  <TextField
                    label="成本"
                    size="small"
                    type="number"
                    value={standardVariant.cost}
                    onChange={(event) =>
                      setStandardVariant({
                        ...standardVariant,
                        cost: event.target.value,
                      })
                    }
                    placeholder="沿用預設"
                    slotProps={{ htmlInput: { min: 0, step: "any" } }}
                  />
                  <Button
                    type="button"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    disabled={!standardVariant.label.trim()}
                    onClick={handleAddStandardVariant}
                    sx={{ minWidth: 96 }}
                  >
                    加入
                  </Button>
                </Box>
                {variantDrafts.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {variantDrafts.map((variant) => (
                      <Chip
                        key={variant.label}
                        label={variant.label}
                        size="small"
                        onDelete={() =>
                          setVariantDrafts((previous) =>
                            previous.filter((item) => item !== variant),
                          )
                        }
                      />
                    ))}
                  </Box>
                )}
              </>
            )}
          </Stack>

          <Divider />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <InfoOutlinedIcon color="info" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              商品照片可在建立商品後於編輯頁面管理。
            </Typography>
          </Box>

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
              建立
            </Button>
          </Box>
        </Stack>
      </form>
    </Paper>
  );
}
