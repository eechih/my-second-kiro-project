import { useConfirmShipment } from "@/hooks/useOrders";
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
import Typography from "@mui/material/Typography";
import { resolveStockQuantity, validateShipment } from "@shared/logic/shipment";
import type { OrderItem, Order } from "@shared/models";
import { useState } from "react";

export interface ShipDialogProps {
  open: boolean;
  onClose: () => void;
  orderItem: OrderItem;
  order: Order;
}

export function ShipDialog({
  open,
  onClose,
  orderItem,
  order,
}: ShipDialogProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const confirmShipment = useConfirmShipment();
  const { data: product } = useProduct(orderItem.productId);

  const stockQty = product ? resolveStockQuantity(product) : 0;

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const validation = validateShipment(orderItem.quantity, stockQty);
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }

    try {
      await confirmShipment.mutateAsync({
        orderId: order.id,
        orderItemId: orderItem.id,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "出貨操作失敗");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        出貨 — {orderItem.productName}
        {orderItem.variantLabel ? ` (${orderItem.variantLabel})` : ""}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            出貨數量：{orderItem.quantity} ／ 目前庫存：{stockQty}
          </Typography>
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
          disabled={confirmShipment.isPending}
          startIcon={
            confirmShipment.isPending ? (
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
