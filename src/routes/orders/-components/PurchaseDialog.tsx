import { EntitySelect } from "@/components/EntitySelect";
import { useCreatePurchaseRecord } from "@/hooks/useOrders";
import { useProduct } from "@/hooks/useProducts";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { resolveEffectiveCost } from "@shared/logic/product-variant";
import {
  calculateRemainingPurchaseQuantity,
  validatePurchaseQuantity,
} from "@shared/logic/purchase-record";
import type { LineItem, Order, Supplier } from "@shared/models";
import { useEffect, useState } from "react";
import { searchSuppliers } from "./orderDetailUtils";

export interface PurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  lineItem: LineItem;
  order: Order;
}

export function PurchaseDialog({
  open,
  onClose,
  lineItem,
  order,
}: PurchaseDialogProps): React.ReactElement {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const createPurchaseRecord = useCreatePurchaseRecord();
  const { data: product } = useProduct(lineItem.productId);

  useEffect(() => {
    if (!open) return;
    if (product) {
      if (lineItem.variantId && product.variants.length > 0) {
        const variant = product.variants.find((v) => v.id === lineItem.variantId);
        setUnitCost(variant ? resolveEffectiveCost(variant, product) : product.defaultCost);
      } else {
        setUnitCost(product.defaultCost);
      }
    }
    const remaining = calculateRemainingPurchaseQuantity(
      lineItem.quantity,
      lineItem.purchasedQuantity,
    );
    setQuantity(Math.max(1, remaining));
    setError(null);
  }, [open, product, lineItem]);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const remaining = calculateRemainingPurchaseQuantity(
      lineItem.quantity,
      lineItem.purchasedQuantity,
    );
    const validation = validatePurchaseQuantity(quantity, remaining);
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }
    if (!supplier) {
      setError("請選取供應商");
      return;
    }

    try {
      await createPurchaseRecord.mutateAsync({
        lineItemId: lineItem.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        quantity,
        unitCost,
        orderId: order.customerId,
        orderSortKey: order.id.split("|")[1] ?? "",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立採購記錄失敗");
    }
  };

  const remaining = calculateRemainingPurchaseQuantity(
    lineItem.quantity,
    lineItem.purchasedQuantity,
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        進貨採購 — {lineItem.productName}
        {lineItem.variantLabel ? ` (${lineItem.variantLabel})` : ""}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            訂購數量：{lineItem.quantity} 已採購：{lineItem.purchasedQuantity} 未採購餘額：{remaining}
          </Typography>
          <EntitySelect<Supplier>
            label="供應商"
            value={supplier}
            onChange={setSupplier}
            searchFn={searchSuppliers}
            getOptionLabel={(s) => `${s.name}（${s.contactPerson}）`}
            required
          />
          <TextField
            label="採購數量"
            type="number"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            slotProps={{ htmlInput: { min: 1, max: remaining } }}
            fullWidth
            required
          />
          <TextField
            label="單位成本"
            type="number"
            value={unitCost}
            onChange={(e) =>
              setUnitCost(Math.max(0, Number(e.target.value) || 0))
            }
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            fullWidth
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          取消
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={createPurchaseRecord.isPending}
          startIcon={
            createPurchaseRecord.isPending ? (
              <CircularProgress size={16} />
            ) : undefined
          }
        >
          建立採購記錄
        </Button>
      </DialogActions>
    </Dialog>
  );
}
