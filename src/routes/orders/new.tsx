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
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { EntitySelect } from "@/components/EntitySelect";
import { VariantSelect } from "@/components/VariantSelect";
import { useCreateOrder } from "@/hooks/useOrders";
import { client } from "@/lib/amplify-client";
import { calculateLineItemSubtotal } from "@shared/logic/order-calculations";
import {
  resolveEffectivePrice,
  validateVariantRequired,
} from "@shared/logic/product-variant";
import type { Customer, Product, ProductVariant } from "@shared/models";

export const Route = createFileRoute("/orders/new")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: OrderNewPage,
});

/** 明細項目表單狀態 */
interface LineItemFormState {
  key: string;
  product: Product | null;
  variant: ProductVariant | null;
  quantity: number;
  unitPrice: number;
  variantError: string | undefined;
}

function OrderNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateOrder();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [lineItems, setLineItems] = useState<LineItemFormState[]>([]);

  // 搜尋客戶
  const searchCustomers = useCallback(async (query: string) => {
    const filter: Record<string, unknown> = {
      isActive: { eq: true },
    };
    if (query) {
      filter.or = [
        { name: { contains: query } },
        { contactPerson: { contains: query } },
      ];
    }
    const { data } = await client.models.Customer.list({ filter, limit: 20 });
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
        }) as Customer,
    );
  }, []);

  // 搜尋商品（僅啟用中）
  const searchProducts = useCallback(async (query: string) => {
    const filter: Record<string, unknown> = {
      isActive: { eq: true },
    };
    if (query) {
      filter.or = [{ name: { contains: query } }, { sku: { contains: query } }];
    }
    const { data } = await client.models.Product.list({
      filter,
      limit: 20,
      selectionSet: [
        "id",
        "name",
        "sku",
        "unitPrice",
        "defaultCost",
        "defaultSupplierId",
        "stockQuantity",
        "specDimensions",
        "imageUrls",
        "isActive",
        "version",
        "createdAt",
        "updatedAt",
        "variants.*",
      ],
    });
    return (data ?? []).map((raw: Record<string, unknown>) =>
      mapRawToProduct(raw),
    );
  }, []);

  // 新增明細項目
  const handleAddLineItem = (): void => {
    setLineItems([
      ...lineItems,
      {
        key: crypto.randomUUID(),
        product: null,
        variant: null,
        quantity: 1,
        unitPrice: 0,
        variantError: undefined,
      },
    ]);
  };

  // 移除明細項目
  const handleRemoveLineItem = (index: number): void => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // 更新明細項目的商品選取
  const handleProductChange = (
    index: number,
    product: Product | null,
  ): void => {
    const updated = [...lineItems];
    const item = updated[index];
    if (!item) return;

    // 當商品變更時自動清空 variantId 並重新設定單價
    item.product = product;
    item.variant = null;
    item.variantError = undefined;

    if (product) {
      // 若商品無規格組合，直接使用商品預設單價
      if (product.variants.length === 0) {
        item.unitPrice = product.unitPrice;
      } else {
        // 有規格組合時，等使用者選取規格後再設定單價
        item.unitPrice = 0;
      }
    } else {
      item.unitPrice = 0;
    }

    setLineItems(updated);
  };

  // 更新明細項目的規格組合選取
  const handleVariantChange = (
    index: number,
    variant: ProductVariant | null,
  ): void => {
    const updated = [...lineItems];
    const item = updated[index];
    if (!item || !item.product) return;

    item.variant = variant;
    item.variantError = undefined;

    if (variant) {
      // 使用 resolveEffectivePrice 解析有效單價
      item.unitPrice = resolveEffectivePrice(variant, item.product);
    } else if (item.product.variants.length === 0) {
      item.unitPrice = item.product.unitPrice;
    } else {
      item.unitPrice = 0;
    }

    setLineItems(updated);
  };

  // 更新明細項目數量
  const handleQuantityChange = (index: number, quantity: number): void => {
    const updated = [...lineItems];
    const item = updated[index];
    if (!item) return;
    item.quantity = Math.max(1, quantity);
    setLineItems(updated);
  };

  // 計算總金額
  const totalAmount = lineItems.reduce((sum, item) => {
    return sum + calculateLineItemSubtotal(item.quantity, item.unitPrice);
  }, 0);

  // TanStack Form 用於管理基本表單狀態
  const form = useForm({
    defaultValues: {
      customerId: "",
    },
    onSubmit: async () => {
      setSubmitError(null);

      // 驗證客戶選取
      if (!selectedCustomer) {
        setSubmitError("請選取客戶");
        return;
      }

      // 驗證至少一筆明細
      if (lineItems.length === 0) {
        setSubmitError("請至少新增一筆明細項目");
        return;
      }

      // 驗證每筆明細
      let hasError = false;
      const updatedItems = [...lineItems];
      for (const item of updatedItems) {
        if (!item.product) {
          setSubmitError("請為所有明細項目選取商品");
          hasError = true;
          break;
        }

        // 驗證規格組合必選
        const variantValidation = validateVariantRequired(
          item.product,
          item.variant?.id ?? null,
        );
        if (!variantValidation.valid) {
          item.variantError = variantValidation.error;
          hasError = true;
        }

        if (item.quantity <= 0) {
          setSubmitError("明細項目數量必須大於 0");
          hasError = true;
          break;
        }
      }

      if (hasError) {
        setLineItems(updatedItems);
        return;
      }

      try {
        await createMutation.mutateAsync({
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          lineItems: lineItems.map((item) => ({
            productId: item.product!.id,
            productName: item.product!.name,
            variantId: item.variant?.id ?? null,
            variantLabel: item.variant?.label ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        });
        void navigate({ to: "/orders" });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "建立訂單失敗");
      }
    },
  });

  return (
    <Box maxWidth={900}>
      <Typography variant="h4" gutterBottom>
        新增訂單
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
            {/* 客戶選取 */}
            <EntitySelect<Customer>
              label="客戶"
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              searchFn={searchCustomers}
              getOptionLabel={(c) => c.name}
              required
            />

            <Divider />

            {/* 明細項目區塊 */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h6">明細項目</Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddLineItem}
              >
                新增明細
              </Button>
            </Box>

            {lineItems.length === 0 ? (
              <Typography
                color="text.secondary"
                sx={{ textAlign: "center", py: 2 }}
              >
                尚未新增明細項目，請點擊「新增明細」按鈕。
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>商品</TableCell>
                      <TableCell>規格組合</TableCell>
                      <TableCell sx={{ width: 100 }}>數量</TableCell>
                      <TableCell sx={{ width: 120 }}>單價</TableCell>
                      <TableCell sx={{ width: 120 }}>小計</TableCell>
                      <TableCell sx={{ width: 50 }}>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <LineItemRow
                        key={item.key}
                        item={item}
                        index={index}
                        onProductChange={handleProductChange}
                        onVariantChange={handleVariantChange}
                        onQuantityChange={handleQuantityChange}
                        onRemove={handleRemoveLineItem}
                        searchProducts={searchProducts}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* 總金額 */}
            {lineItems.length > 0 && (
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Typography variant="h6">
                  總金額：${totalAmount.toLocaleString()}
                </Typography>
              </Box>
            )}

            <Divider />

            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                onClick={() => void navigate({ to: "/orders" })}
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
                建立訂單
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// LineItemRow 子元件
// ---------------------------------------------------------------------------

interface LineItemRowProps {
  item: LineItemFormState;
  index: number;
  onProductChange: (index: number, product: Product | null) => void;
  onVariantChange: (index: number, variant: ProductVariant | null) => void;
  onQuantityChange: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
  searchProducts: (query: string) => Promise<Product[]>;
}

function LineItemRow({
  item,
  index,
  onProductChange,
  onVariantChange,
  onQuantityChange,
  onRemove,
  searchProducts,
}: LineItemRowProps): React.ReactElement {
  const subtotal = calculateLineItemSubtotal(item.quantity, item.unitPrice);
  const hasVariants = (item.product?.variants.length ?? 0) > 0;

  return (
    <TableRow>
      <TableCell sx={{ minWidth: 200 }}>
        <EntitySelect<Product>
          label="商品"
          value={item.product}
          onChange={(product) => onProductChange(index, product)}
          searchFn={searchProducts}
          getOptionLabel={(p) => `${p.name}（${p.sku}）`}
          required
        />
      </TableCell>
      <TableCell sx={{ minWidth: 180 }}>
        {hasVariants && item.product ? (
          <VariantSelect
            productId={item.product.id}
            variants={item.product.variants}
            value={item.variant}
            onChange={(variant) => onVariantChange(index, variant)}
            error={item.variantError}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <TextField
          type="number"
          size="small"
          value={item.quantity}
          onChange={(e) =>
            onQuantityChange(index, parseInt(e.target.value, 10) || 1)
          }
          slotProps={{ htmlInput: { min: 1 } }}
          sx={{ width: 80 }}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          ${item.unitPrice.toLocaleString()}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          ${subtotal.toLocaleString()}
        </Typography>
      </TableCell>
      <TableCell>
        <IconButton size="small" color="error" onClick={() => onRemove(index)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 將 Amplify 原始資料映射為 Product 型別 */
function mapRawToProduct(raw: Record<string, unknown>): Product {
  let specDimensions: Product["specDimensions"] = [];
  if (raw.specDimensions) {
    try {
      specDimensions =
        typeof raw.specDimensions === "string"
          ? JSON.parse(raw.specDimensions)
          : (raw.specDimensions as Product["specDimensions"]);
    } catch {
      specDimensions = [];
    }
  }

  let variants: ProductVariant[] = [];
  if (raw.variants && Array.isArray(raw.variants)) {
    variants = (raw.variants as Record<string, unknown>[]).map((v) => {
      let combination: Record<string, string> = {};
      if (v.combination) {
        try {
          combination =
            typeof v.combination === "string"
              ? JSON.parse(v.combination)
              : (v.combination as Record<string, string>);
        } catch {
          combination = {};
        }
      }
      return {
        id: String(v.id ?? ""),
        combination,
        label: String(v.label ?? ""),
        sku: String(v.sku ?? ""),
        stockQuantity: Number(v.stockQuantity ?? 0),
        unitPriceOverride:
          v.unitPriceOverride !== null && v.unitPriceOverride !== undefined
            ? Number(v.unitPriceOverride)
            : null,
        defaultCostOverride:
          v.defaultCostOverride !== null && v.defaultCostOverride !== undefined
            ? Number(v.defaultCostOverride)
            : null,
        version: Number(v.version ?? 1),
      };
    });
  }

  const stockQuantity =
    variants.length > 0
      ? variants.reduce((sum, v) => sum + v.stockQuantity, 0)
      : Number(raw.stockQuantity ?? 0);

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    sku: String(raw.sku ?? ""),
    unitPrice: Number(raw.unitPrice ?? 0),
    defaultCost: Number(raw.defaultCost ?? 0),
    defaultSupplierId: raw.defaultSupplierId
      ? String(raw.defaultSupplierId)
      : null,
    stockQuantity,
    specDimensions,
    variants,
    imageUrls: Array.isArray(raw.imageUrls)
      ? (raw.imageUrls as string[]).filter(Boolean)
      : [],
    isActive: raw.isActive !== false,
    version: Number(raw.version ?? 1),
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}
