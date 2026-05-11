import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useAddLineItemToOrder,
  useDeleteLineItemFromOrder,
  useUpdateLineItemInOrder,
} from "@/hooks/useOrders";
import { formatCurrency } from "@/lib/currency";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { LineItem, Order } from "@shared/models";
import { useCallback, useState } from "react";
import {
  LineItemDialog,
  type LineItemEditData,
} from "../create/LineItemDialog";
import type { CreateLineItemInput } from "../create/formTypes";
import { LineItemRow } from "./LineItemRow";

interface DialogState {
  open: boolean;
  editLineItem: LineItem | null;
}

export interface LineItemsCardProps {
  order: Order;
}

export function LineItemsCard({
  order,
}: LineItemsCardProps): React.ReactElement {
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    editLineItem: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<LineItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addLineItem = useAddLineItemToOrder();
  const updateLineItem = useUpdateLineItemInOrder();
  const deleteLineItem = useDeleteLineItemFromOrder();

  const canEdit = order.status === "pending" || order.status === "confirmed";

  const openAddDialog = useCallback(() => {
    setDialog({ open: true, editLineItem: null });
    setError(null);
  }, []);

  const openEditDialog = useCallback((lineItem: LineItem) => {
    setDialog({ open: true, editLineItem: lineItem });
    setError(null);
  }, []);

  const closeDialog = useCallback(() => {
    setDialog({ open: false, editLineItem: null });
  }, []);

  const handleDialogSubmit = useCallback(
    async (input: CreateLineItemInput) => {
      setError(null);
      try {
        if (dialog.editLineItem) {
          await updateLineItem.mutateAsync({
            orderId: order.id,
            lineItemId: dialog.editLineItem.id,
            productId: input.productId,
            productName: input.productName,
            variantLabel: input.variantLabel ?? null,
            quantity: input.quantity,
            unitPrice: input.unitPrice,
          });
        } else {
          await addLineItem.mutateAsync({
            orderId: order.id,
            productId: input.productId,
            productName: input.productName,
            variantLabel: input.variantLabel ?? null,
            quantity: input.quantity,
            unitPrice: input.unitPrice,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "操作失敗");
      }
    },
    [dialog.editLineItem, order.id, addLineItem, updateLineItem],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await deleteLineItem.mutateAsync({
        orderId: order.id,
        lineItemId: deleteTarget.id,
      });
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除明細失敗");
      setDeleteTarget(null);
    }
  }, [deleteTarget, order.id, deleteLineItem]);

  const editData: LineItemEditData | null = dialog.editLineItem
    ? {
        productId: dialog.editLineItem.productId,
        productName: dialog.editLineItem.productName,
        variantLabel: dialog.editLineItem.variantLabel,
        quantity: dialog.editLineItem.quantity,
        unitPrice: dialog.editLineItem.unitPrice,
      }
    : null;

  return (
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
        {canEdit && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={openAddDialog}
          >
            新增明細
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 50 }} />
              <TableCell>商品名稱</TableCell>
              <TableCell>規格組合</TableCell>
              <TableCell align="right">數量</TableCell>
              <TableCell align="right">單價</TableCell>
              <TableCell align="right">小計</TableCell>
              <TableCell>供應商</TableCell>
              <TableCell align="right">採購成本</TableCell>
              <TableCell align="center">狀態</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {order.lineItems.map((lineItem) => (
              <LineItemRow
                key={lineItem.id}
                lineItem={lineItem}
                order={order}
                canEdit={canEdit}
                onEdit={() => openEditDialog(lineItem)}
                onDelete={() => setDeleteTarget(lineItem)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
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
          總金額：{formatCurrency(order.totalAmount)}
        </Typography>
      </Box>

      <LineItemDialog
        open={dialog.open}
        editData={editData}
        onClose={closeDialog}
        onSubmit={(input) => void handleDialogSubmit(input)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="刪除明細"
        message={`確定要刪除「${deleteTarget?.productName ?? ""}${deleteTarget?.variantLabel ? ` (${deleteTarget.variantLabel})` : ""}」嗎？此操作無法復原。`}
        confirmLabel="確認刪除"
        confirmColor="error"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </Paper>
  );
}
