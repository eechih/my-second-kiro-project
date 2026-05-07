import { EntitySelect } from "@/components/EntitySelect";
import { VariantSelect } from "@/components/VariantSelect";
import { useCreateOrder } from "@/hooks/useOrders";
import { useProduct } from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { calculateLineItemSubtotal } from "@shared/logic/order-calculations";
import { resolveEffectivePrice } from "@shared/logic/product-variant";
import type { Customer, Product, ProductVariant } from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/orders/new")({
  beforeLoad: ({ context }) => {
    if (context.auth.isLoading) {
      return;
    }
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: OrderNewPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItemFormData {
  /** 臨時 ID（用於 React key） */
  tempId: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** 搜尋啟用中的客戶 */
async function searchCustomers(query: string): Promise<Customer[]> {
  const filter: Record<string, unknown> = { isActive: { eq: true } };
  if (query) {
    filter.or = [
      { name: { contains: query } },
      { contactPerson: { contains: query } },
    ];
  }

  const { data } = await client.models.Customer.list({
    filter,
    limit: 20,
  });

  return (data ?? []).map((raw: Record<string, unknown>) => ({
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    contactPerson: String(raw.contactPerson ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    isActive: true,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  }));
}

/** 搜尋啟用中的商品（含規格組合） */
async function searchProducts(query: string): Promise<Product[]> {
  const filter: Record<string, unknown> = { isActive: { eq: true } };
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

  return (data ?? []).map((raw: Record<string, unknown>) => {
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
      variants = (raw.variants as Record<string, unknown>[]).map(
        (v: Record<string, unknown>) => {
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
              v.defaultCostOverride !== null &&
              v.defaultCostOverride !== undefined
                ? Number(v.defaultCostOverride)
                : null,
            version: Number(v.version ?? 1),
          };
        },
      );
    }

    return {
      id: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      sku: String(raw.sku ?? ""),
      unitPrice: Number(raw.unitPrice ?? 0),
      defaultCost: Number(raw.defaultCost ?? 0),
      defaultSupplierId: raw.defaultSupplierId
        ? String(raw.defaultSupplierId)
        : null,
      stockQuantity:
        variants.length > 0
          ? variants.reduce((sum, v) => sum + v.stockQuantity, 0)
          : Number(raw.stockQuantity ?? 0),
      specDimensions,
      variants,
      imageUrls: Array.isArray(raw.imageUrls)
        ? (raw.imageUrls as string[]).filter(Boolean)
        : [],
      isActive: true,
      version: Number(raw.version ?? 1),
      createdAt: String(raw.createdAt ?? ""),
      updatedAt: String(raw.updatedAt ?? ""),
    };
  });
}

// ---------------------------------------------------------------------------
// Line Item Row Component
// ---------------------------------------------------------------------------

interface LineItemRowProps {
  item: LineItemFormData;
  index: number;
  onRemove: () => void;
  onUpdate: (updates: Partial<LineItemFormData>) => void;
}

function LineItemRow({ item, index, onRemove, onUpdate }: LineItemRowProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null,
  );
  const [variantError, setVariantError] = useState<string | undefined>(
    undefined,
  );

  // Load product details when productId is set (for variant info)
  const { data: productDetail } = useProduct(item.productId || "");

  // Sync product detail when loaded
  useEffect(() => {
    if (productDetail && productDetail.id === item.productId) {
      setSelectedProduct(productDetail);
    }
  }, [productDetail, item.productId]);

  const handleProductChange = useCallback(
    (product: Product | null) => {
      setSelectedProduct(product);
      setSelectedVariant(null);
      setVariantError(undefined);

      if (product) {
        const unitPrice = product.unitPrice;
        onUpdate({
          productId: product.id,
          productName: product.name,
          variantId: null,
          variantLabel: null,
          unitPrice,
        });
      } else {
        onUpdate({
          productId: "",
          productName: "",
          variantId: null,
          variantLabel: null,
          unitPrice: 0,
        });
      }
    },
    [onUpdate],
  );

  const handleVariantChange = useCallback(
    (variant: ProductVariant | null) => {
      setSelectedVariant(variant);

      if (variant && selectedProduct) {
        const effectivePrice = resolveEffectivePrice(variant, selectedProduct);
        setVariantError(undefined);
        onUpdate({
          variantId: variant.id,
          variantLabel: variant.label,
          unitPrice: effectivePrice,
        });
      } else {
        onUpdate({
          variantId: null,
          variantLabel: null,
          unitPrice: selectedProduct?.unitPrice ?? 0,
        });
        // Validate variant required
        if (
          selectedProduct &&
          selectedProduct.variants.length > 0 &&
          !variant
        ) {
          setVariantError("請選取規格組合");
        }
      }
    },
    [onUpdate, selectedProduct],
  );

  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const qty = Math.max(1, parseInt(e.target.value, 10) || 1);
      onUpdate({ quantity: qty });
    },
    [onUpdate],
  );

  const subtotal = calculateLineItemSubtotal(item.quantity, item.unitPrice);
  const hasVariants = selectedProduct
    ? selectedProduct.variants.length > 0
    : false;

  return (
    <TableRow>
      <TableCell sx={{ width: 40 }}>{index + 1}</TableCell>
      <TableCell sx={{ minWidth: 200 }}>
        <EntitySelect<Product>
          label="商品"
          value={selectedProduct}
          onChange={handleProductChange}
          searchFn={searchProducts}
          getOptionLabel={(p) => `${p.name}（${p.sku}）`}
          required
          error={!item.productId ? "請選取商品" : undefined}
        />
      </TableCell>
      <TableCell sx={{ minWidth: 180 }}>
        {hasVariants ? (
          <VariantSelect
            productId={item.productId}
            variants={selectedProduct?.variants ?? []}
            value={selectedVariant}
            onChange={handleVariantChange}
            error={variantError}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ width: 100 }}>
        <TextField
          type="number"
          value={item.quantity}
          onChange={handleQuantityChange}
          size="small"
          slotProps={{ htmlInput: { min: 1 } }}
          sx={{ width: 80 }}
        />
      </TableCell>
      <TableCell sx={{ width: 120 }}>
        <TextField
          type="number"
          value={item.unitPrice}
          onChange={(e) =>
            onUpdate({ unitPrice: Math.max(0, Number(e.target.value) || 0) })
          }
          size="small"
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          sx={{ width: 100 }}
        />
      </TableCell>
      <TableCell sx={{ width: 100 }} align="right">
        {subtotal.toLocaleString()}
      </TableCell>
      <TableCell sx={{ width: 50 }}>
        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

function OrderNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateOrder();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([]);

  const form = useForm({
    defaultValues: {
      customerId: "",
      customerName: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      // Validate customer
      if (!value.customerId) {
        setSubmitError("請選取客戶");
        return;
      }

      // Validate line items
      if (lineItems.length === 0) {
        setSubmitError("請至少新增一筆明細項目");
        return;
      }

      // Validate each line item
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i]!;
        if (!item.productId) {
          setSubmitError(`第 ${i + 1} 筆明細項目未選取商品`);
          return;
        }
        if (item.quantity <= 0) {
          setSubmitError(`第 ${i + 1} 筆明細項目數量必須大於 0`);
          return;
        }
      }

      try {
        await createMutation.mutateAsync({
          customerId: value.customerId,
          customerName: value.customerName,
          lineItems: lineItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            variantId: item.variantId,
            variantLabel: item.variantLabel,
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

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const handleCustomerChange = useCallback(
    (customer: Customer | null) => {
      setSelectedCustomer(customer);
      if (customer) {
        form.setFieldValue("customerId", customer.id);
        form.setFieldValue("customerName", customer.name);
      } else {
        form.setFieldValue("customerId", "");
        form.setFieldValue("customerName", "");
      }
    },
    [form],
  );

  const handleAddLineItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      {
        tempId: generateTempId(),
        productId: "",
        productName: "",
        variantId: null,
        variantLabel: null,
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }, []);

  const handleRemoveLineItem = useCallback((index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateLineItem = useCallback(
    (index: number, updates: Partial<LineItemFormData>) => {
      setLineItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  // Calculate total amount
  const totalAmount = lineItems.reduce(
    (sum, item) =>
      sum + calculateLineItemSubtotal(item.quantity, item.unitPrice),
    0,
  );

  return (
    <Box>
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <Stack spacing={3}>
          {/* 客戶選取 */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              客戶資訊
            </Typography>
            <EntitySelect<Customer>
              label="客戶"
              value={selectedCustomer}
              onChange={handleCustomerChange}
              searchFn={searchCustomers}
              getOptionLabel={(c) => `${c.name}（${c.contactPerson}）`}
              required
              error={
                form.state.isSubmitted && !selectedCustomer
                  ? "請選取客戶"
                  : undefined
              }
            />
          </Paper>

          {/* 明細項目 */}
          <Paper sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
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
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                尚未新增明細項目，請點擊「新增明細」按鈕
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>商品</TableCell>
                      <TableCell>規格組合</TableCell>
                      <TableCell>數量</TableCell>
                      <TableCell>單價</TableCell>
                      <TableCell align="right">小計</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <LineItemRow
                        key={item.tempId}
                        item={item}
                        index={index}
                        onRemove={() => handleRemoveLineItem(index)}
                        onUpdate={(updates) =>
                          handleUpdateLineItem(index, updates)
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* 總金額 */}
            {lineItems.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  mt: 2,
                  pt: 2,
                  borderTop: 1,
                  borderColor: "divider",
                }}
              >
                <Typography variant="h6">
                  總金額：{totalAmount.toLocaleString()}
                </Typography>
              </Box>
            )}
          </Paper>

          {/* 操作按鈕 */}
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
    </Box>
  );
}
