import { useShipLineItem } from "@/hooks/useOrders";
import { useProduct } from "@/hooks/useProducts";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
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
import {
  calculateRemainingShipQuantity,
  resolveStockQuantity,
  validateShipment,
} from "@shared/logic/shipment";
import type { LineItem, Order } from "@shared/models";
import { useState } from "react";

export interface ShipDialogProps {
  open: boolean;
  onClose: () => void;
  lineItem: LineItem;
  order: Order;
}

export function ShipDialog({
  open,
  onClose,
  lineItem,
  order,
}: ShipDialogProps): React.ReactElement {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const shipLineItem = useShipLineItem();
  const { data: product } = useProduct(lineItem.productId);

  const remainingShip = calculateRemainingShipQuantity(
    lineItem.quantity,
    lineItem.shippedQuantity,
  );
  const stockQty = product
    ? resolveStockQuantity(product, lineItem.variantId)
    : 0;

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const validation = validateShipment(quantity, remainingShip, stockQty);
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }

    try {
      await shipLineItem.mutateAsync({
        orderId: order.id,
        lineItemId: lineItem.id,
        quantity,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "出貨操作失敗");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        出貨 — {lineItem.productName}
        {lineItem.variantLabel ? ` (${lineItem.variantLabel})` : ""}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            訂購數量：{lineItem.quantity} 已出貨：{lineItem.shippedQuantity} 未出貨餘額：{remainingShip} 目前庫存：{stockQty}
          </Typography>
          <TextField
            label="出貨數量"
            type="number"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            slotProps={{
              htmlInput: { min: 1, max: Math.min(remainingShip, stockQty) },
            }}
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
          color="primary"
          disabled={shipLineItem.isPending}
          startIcon={
            shipLineItem.isPending ? (
              <CircularProgress size={16} />
            ) : (
              <LocalShippingIcon />
            )
          }
        >
          確認出貨
        </Button>
      </DialogActions>
    </Dialog>
  );
}
