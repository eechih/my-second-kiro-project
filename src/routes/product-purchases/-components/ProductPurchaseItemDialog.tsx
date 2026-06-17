import { EntitySelect } from "@/components/EntitySelect";
import { ProductOptionValueSelects } from "@/components/ProductOptionValueSelects";
import { client } from "@/lib/amplify-client";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import {
  normalizeOrderStatus,
  type OrderItemSelectedOptionSnapshot,
  type Product,
  type ProductOptionValue,
  type Supplier,
} from "@shared/models";
import { useEffect, useState } from "react";
import {
  buildOrderItemFormData,
  getOrderItemDraftError,
  resolveDraftUnitPrice,
} from "../../orders/-components/create/orderItemDraft";

export interface OrderSelectionOption {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
}

export interface ProductPurchaseItemEditData {
  orderId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  supplierName: string | null;
  selectedOptionsSnapshot: OrderItemSelectedOptionSnapshot[];
  variantLabel: string | null;
}

export interface ProductPurchaseItemSubmitInput {
  orderId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  supplierName: string | null;
  variantLabel: string | null;
  selectedOptionsSnapshot: OrderItemSelectedOptionSnapshot[];
}

export interface ProductPurchaseItemDialogProps {
  open: boolean;
  product: Product;
  editData: ProductPurchaseItemEditData | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: ProductPurchaseItemSubmitInput) => Promise<void>;
}

function isEligibleOrder(raw: Record<string, unknown>): boolean {
  const status = normalizeOrderStatus(raw.status);
  return status === "PENDING" || status === "ORDERED";
}

function mapOrderOption(raw: Record<string, unknown>): OrderSelectionOption {
  return {
    id: String(raw.id ?? ""),
    orderNumber: String(raw.orderNumber ?? ""),
    customerName: String(raw.customerNameSnapshot ?? ""),
    status: normalizeOrderStatus(raw.status),
  };
}

async function listAvailableOrders(): Promise<OrderSelectionOption[]> {
  const { data, errors } = await client.models.Order.listOrdersByCreatedDate(
    { gsiPartition: "Order" },
    {
      sortDirection: "DESC",
      limit: 50,
      selectionSet: [
        "id",
        "orderNumber",
        "customerNameSnapshot",
        "status",
      ],
    } as Record<string, unknown>,
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢訂單失敗");
  }

  return (data ?? [])
    .filter((item) => isEligibleOrder(item as unknown as Record<string, unknown>))
    .map((item) => mapOrderOption(item as unknown as Record<string, unknown>));
}

async function searchAvailableOrders(
  query: string,
): Promise<OrderSelectionOption[]> {
  const trimmedQuery = query.trim();
  const filter: Record<string, unknown> = {
    or: [
      { orderNumber: { contains: trimmedQuery } },
      { customerNameSnapshot: { contains: trimmedQuery } },
    ],
  };

  const { data, errors } = await client.models.Order.list({
    filter,
    limit: 20,
    selectionSet: [
      "id",
      "orderNumber",
      "customerNameSnapshot",
      "status",
    ],
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "搜尋訂單失敗");
  }

  return (data ?? [])
    .filter((item) => isEligibleOrder(item as unknown as Record<string, unknown>))
    .map((item) => mapOrderOption(item as unknown as Record<string, unknown>));
}

async function listSupplierOptions(): Promise<Supplier[]> {
  const { data, errors } = await client.models.Supplier.list({
    filter: { isActive: { eq: true } },
    limit: 100,
    selectionSet: [
      "id",
      "name",
      "phone",
      "email",
      "address",
      "isActive",
      "createdAt",
      "updatedAt",
    ],
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢供應商失敗");
  }

  return (data ?? []).map((raw) => ({
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    translationParser: null,
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  }));
}

export function ProductPurchaseItemDialog({
  open,
  product,
  editData,
  isSubmitting,
  onClose,
  onSubmit,
}: ProductPurchaseItemDialogProps): React.ReactElement {
  const [selectedOrder, setSelectedOrder] = useState<OrderSelectionOption | null>(
    null,
  );
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedOptionValues, setSelectedOptionValues] = useState<
    Record<string, ProductOptionValue | null>
  >({});
  const [legacyVariantLabel, setLegacyVariantLabel] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(product.price);
  const [unitCost, setUnitCost] = useState<number | null>(product.cost);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setSelectedSupplier(
      editData?.supplierName
        ? {
            id: "",
            name: editData.supplierName,
            phone: "",
            email: "",
            address: "",
            translationParser: null,
            isActive: true,
            createdAt: "",
            updatedAt: "",
          }
        : null,
    );
    setSelectedOptionValues({});
    setLegacyVariantLabel(editData?.variantLabel ?? null);
    setQuantity(editData?.quantity ?? 1);
    setUnitPrice(editData?.unitPrice ?? resolveDraftUnitPrice(product, []));
    setUnitCost(editData?.unitCost ?? product.cost);
    setError(null);

    if (!editData) {
      setSelectedOrder(null);
      return;
    }

    setSelectedOrder({
      id: editData.orderId,
      orderNumber: "",
      customerName: "",
      status: "PENDING",
    });

    if (product.options.length > 0) {
      const fallbackTokens =
        editData.variantLabel
          ?.split("/")
          .map((token) => token.trim())
          .filter(Boolean) ?? [];

      setSelectedOptionValues(
        Object.fromEntries(
          product.options.map((option, index) => {
            const matchedSnapshot =
              editData.selectedOptionsSnapshot.find(
                (snapshot) => snapshot.optionName === option.name,
              ) ?? null;
            const matchedValue =
              option.values.find(
                (value) =>
                  value.name === matchedSnapshot?.valueName ||
                  value.name === fallbackTokens[index],
              ) ?? null;
            return [option.id, matchedValue];
          }),
        ),
      );
    }
  }, [editData, open, product]);

  const handleOptionValueChange = (
    optionId: string,
    value: ProductOptionValue | null,
  ): void => {
    const nextSelectedOptionValues = {
      ...selectedOptionValues,
      [optionId]: value,
    };
    setSelectedOptionValues(nextSelectedOptionValues);
    setError(null);

    const selectedValues = product.options
      .map((option) => nextSelectedOptionValues[option.id] ?? null)
      .filter(
        (optionValue): optionValue is ProductOptionValue => optionValue !== null,
      );

    setUnitPrice(resolveDraftUnitPrice(product, selectedValues));
    const costOffset = selectedValues.reduce(
      (sum, optionValue) => sum + optionValue.costOffset,
      0,
    );
    setUnitCost(product.cost + costOffset);
  };

  const handleSubmit = async (): Promise<void> => {
    const draft = {
      product,
      selectedOptionValues: Object.values(selectedOptionValues).filter(
        (value): value is ProductOptionValue => value !== null,
      ),
      legacyVariantLabel,
      quantity,
      unitPrice,
    };

    if (!selectedOrder?.id) {
      setError("請選取訂單");
      return;
    }

    const validationError = getOrderItemDraftError(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = buildOrderItemFormData(draft);

    setError(null);
    await onSubmit({
      orderId: selectedOrder.id,
      quantity: formData.quantity,
      unitPrice,
      unitCost,
      supplierName: selectedSupplier?.name ?? editData?.supplierName ?? null,
      variantLabel: formData.variantLabel,
      selectedOptionsSnapshot: formData.selectedOptionsSnapshot ?? [],
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editData ? "編輯作業明細" : "新增作業明細"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField label="商品" value={product.name} disabled fullWidth />

          <EntitySelect<OrderSelectionOption>
            label="訂單"
            value={selectedOrder}
            onChange={setSelectedOrder}
            queryKey={["orders", "product-purchase-dialog"]}
            listFn={listAvailableOrders}
            searchFn={searchAvailableOrders}
            getOptionLabel={(order) =>
              order.orderNumber
                ? `${order.orderNumber} / ${order.customerName}`
                : editData?.orderId === order.id
                  ? `目前訂單 / ${editData.orderId}`
                  : order.id
            }
            disabled={!!editData}
            required
          />

          {product.options.length > 0 ? (
            <ProductOptionValueSelects
              options={product.options}
              value={selectedOptionValues}
              onChange={handleOptionValueChange}
              error={error === "請選取所有規格選項" ? error : undefined}
            />
          ) : null}

          <EntitySelect<Supplier>
            label="供應商"
            value={selectedSupplier}
            onChange={setSelectedSupplier}
            queryKey={["suppliers", "product-purchase-dialog"]}
            listFn={listSupplierOptions}
            searchFn={async (query) => {
              const suppliers = await listSupplierOptions();
              const trimmed = query.trim();
              return trimmed
                ? suppliers.filter((supplier) => supplier.name.includes(trimmed))
                : suppliers;
            }}
            getOptionLabel={(supplier) => supplier.name}
            filterActive={false}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="數量"
              type="number"
              value={quantity}
              onChange={(event) => {
                setQuantity(Math.max(1, parseInt(event.target.value, 10) || 1));
                setError(null);
              }}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              fullWidth
            />
            <TextField
              label="單價"
              type="number"
              value={unitPrice}
              onChange={(event) => {
                setUnitPrice(
                  Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                );
                setError(null);
              }}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              fullWidth
            />
            <TextField
              label="採購成本"
              type="number"
              value={unitCost ?? ""}
              onChange={(event) => {
                const value = event.target.value.trim();
                setUnitCost(
                  value ? Math.max(0, Math.trunc(Number(value) || 0)) : null,
                );
                setError(null);
              }}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          取消
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={isSubmitting}
        >
          {editData ? "儲存" : "新增"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
