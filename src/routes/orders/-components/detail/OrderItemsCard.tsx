import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useAddOrderItemToOrder,
  useDeleteOrderItemFromOrder,
  useUpdateOrderItemInOrder,
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
import type { OrderItem, Order } from "@shared/models";
import { useCallback, useState } from "react";
import {
  OrderItemDialog,
  type OrderItemEditData,
} from "../create/OrderItemDialog";
import type { CreateOrderItemInput } from "../create/formTypes";
import { OrderItemRow } from "./OrderItemRow";

interface DialogState {
  open: boolean;
  editOrderItem: OrderItem | null;
}

export interface OrderItemsCardProps {
  order: Order;
}

export function OrderItemsCard({
  order,
}: OrderItemsCardProps): React.ReactElement {
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    editOrderItem: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<OrderItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addOrderItem = useAddOrderItemToOrder();
  const updateOrderItem = useUpdateOrderItemInOrder();
  const deleteOrderItem = useDeleteOrderItemFromOrder();

  const canEdit =
    order.status === "PENDING" || order.status === "ORDERED";

  const openAddDialog = useCallback(() => {
    setDialog({ open: true, editOrderItem: null });
    setError(null);
  }, []);

  const openEditDialog = useCallback((orderItem: OrderItem) => {
    setDialog({ open: true, editOrderItem: orderItem });
    setError(null);
  }, []);

  const closeDialog = useCallback(() => {
    setDialog({ open: false, editOrderItem: null });
  }, []);

  const handleDialogSubmit = useCallback(
    async (input: CreateOrderItemInput) => {
      setError(null);
      try {
        if (dialog.editOrderItem) {
          await updateOrderItem.mutateAsync({
            orderId: order.id,
            orderItemId: dialog.editOrderItem.id,
            productId: input.productId,
            productName: input.productName,
            productImageUrl: input.productImageUrl ?? null,
            productSku: input.productSku,
            variantLabel: input.variantLabel ?? null,
            selectedOptionsSnapshot: input.selectedOptionsSnapshot ?? [],
            quantity: input.quantity,
            unitPrice: input.unitPrice,
            unitCost: input.unitCost ?? null,
          });
        } else {
          await addOrderItem.mutateAsync({
            orderId: order.id,
            productId: input.productId,
            productName: input.productName,
            productImageUrl: input.productImageUrl ?? null,
            productSku: input.productSku,
            variantLabel: input.variantLabel ?? null,
            selectedOptionsSnapshot: input.selectedOptionsSnapshot ?? [],
            quantity: input.quantity,
            unitPrice: input.unitPrice,
            unitCost: input.unitCost ?? null,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "操作失敗");
      }
    },
    [dialog.editOrderItem, order.id, addOrderItem, updateOrderItem],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await deleteOrderItem.mutateAsync({
        orderId: order.id,
        orderItemId: deleteTarget.id,
      });
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除明細失敗");
      setDeleteTarget(null);
    }
  }, [deleteTarget, order.id, deleteOrderItem]);

  const editData: OrderItemEditData | null = dialog.editOrderItem
    ? {
        productId: dialog.editOrderItem.productId,
        productName: dialog.editOrderItem.productName,
        productImageUrl: dialog.editOrderItem.productImageUrl,
        productSku: dialog.editOrderItem.productSku ?? "",
        variantLabel: dialog.editOrderItem.variantLabel,
        selectedOptionsSnapshot: dialog.editOrderItem.selectedOptionsSnapshot,
        quantity: dialog.editOrderItem.quantity,
        unitPrice: dialog.editOrderItem.unitPrice,
        unitCost: dialog.editOrderItem.unitCostSnapshot,
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
            {order.items.map((orderItem) => (
              <OrderItemRow
                key={orderItem.id}
                orderItem={orderItem}
                order={order}
                canEdit={canEdit}
                onEdit={() => openEditDialog(orderItem)}
                onDelete={() => setDeleteTarget(orderItem)}
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

      <OrderItemDialog
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
