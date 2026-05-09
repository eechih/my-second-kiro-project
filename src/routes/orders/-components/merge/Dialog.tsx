import type { Order } from "@shared/models";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

export interface MergeDialogProps {
  open: boolean;
  orders: Order[];
  totalAmount: number;
  lineItemCount: number;
  error: string | null;
  isPending: boolean;
  onClose: () => void;
  onClearError: () => void;
  onConfirm: () => void;
}

export function MergeDialog({
  open,
  orders,
  totalAmount,
  lineItemCount,
  error,
  isPending,
  onClose,
  onClearError,
  onConfirm,
}: MergeDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>合併訂單</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={onClearError}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          已選取合併的訂單
        </Typography>
        <Box sx={{ display: "grid", gap: 1, mb: 2 }}>
          {orders.map((order) => (
            <Box
              key={order.id}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="body2">{order.orderNumber}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {order.customerName}
                </Typography>
              </Box>
              <Typography variant="body2">
                ${order.totalAmount.toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          合併預覽資訊
        </Typography>
        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography variant="body2">選取訂單數：{orders.length} 筆</Typography>
          <Typography variant="body2">
            合併後明細項目數：{lineItemCount} 項
          </Typography>
          <Typography variant="body2">
            合併後總金額：${totalAmount.toLocaleString()}
          </Typography>
        </Box>

        <Alert severity="warning" sx={{ mt: 2 }}>
          合併後，來源訂單將被取消，並建立一筆包含所有明細項目的新訂單。
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" disabled={isPending} onClick={onClose}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={isPending}
          startIcon={
            isPending ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {isPending ? "合併中..." : "確認合併"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
