import { EntitySelect } from "@/components/EntitySelect";
import { useMarkProcurement } from "@/hooks/useOrders";
import { client } from "@/lib/amplify-client";
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
import { validateProcurementOrder } from "@shared/logic/procurement";
import type { LineItem, Order, Supplier } from "@shared/models";
import { useEffect, useState } from "react";
import { searchSuppliers } from "../detail/detailUtils";

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
  const [unitCost, setUnitCost] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const markProcurement = useMarkProcurement();

  useEffect(() => {
    if (!open) return;
    setSupplier(null);
    setUnitCost(0);
    setError(null);
  }, [open]);

  const handleSubmit = async (): Promise<void> => {
    setError(null);

    if (!supplier) {
      setError("請選取供應商");
      return;
    }

    const validation = validateProcurementOrder(
      lineItem,
      supplier.id,
      unitCost,
    );
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }

    try {
      // 1. 先更新 LineItem 的供應商與成本資料
      await client.models.LineItem.update({
        id: lineItem.id,
        supplierName: supplier.name,
        unitCost,
      });

      // 2. 再呼叫 confirmPurchase 做狀態轉換 pending → ordered
      await markProcurement.mutateAsync({
        orderId: order.id,
        lineItemId: lineItem.id,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "標記採購失敗");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        標記採購 — {lineItem.productName}
        {lineItem.variantLabel ? ` (${lineItem.variantLabel})` : ""}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            訂購數量：{lineItem.quantity}（全量採購）
          </Typography>
          <EntitySelect<Supplier>
            label="供應商"
            value={supplier}
            onChange={setSupplier}
            queryKey={["suppliers", "select"]}
            searchFn={searchSuppliers}
            getOptionLabel={(s) => `${s.name}（${s.contactPerson}）`}
            required
          />
          <TextField
            label="單位成本"
            type="number"
            value={unitCost}
            onChange={(e) =>
              setUnitCost(Math.max(0, Math.trunc(Number(e.target.value) || 0)))
            }
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
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
          disabled={markProcurement.isPending}
          startIcon={
            markProcurement.isPending ? (
              <CircularProgress size={16} />
            ) : undefined
          }
        >
          確認採購
        </Button>
      </DialogActions>
    </Dialog>
  );
}
