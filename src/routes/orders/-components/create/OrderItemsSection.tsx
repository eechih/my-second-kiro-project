import { formatCurrency } from "@/lib/currency";
import AddIcon from "@mui/icons-material/Add";
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
import { useCallback, useState } from "react";
import { OrderItemDialog, type OrderItemEditData } from "./OrderItemDialog";
import type { CreateOrderItemInput, OrderItemFormData } from "./formTypes";
import { OrderItemRow } from "./OrderItemRow";

interface DialogState {
  open: boolean;
  /** 編輯模式時的明細索引，null 為新增模式 */
  editIndex: number | null;
  editData: OrderItemEditData | null;
}

export interface OrderItemsSectionProps {
  orderItems: OrderItemFormData[];
  totalAmount: number;
  onAddOrderItem: (input: CreateOrderItemInput) => void;
  onRemoveOrderItem: (index: number) => void;
  onUpdateOrderItem: (index: number, input: CreateOrderItemInput) => void;
}

export function OrderItemsSection({
  orderItems,
  totalAmount,
  onAddOrderItem,
  onRemoveOrderItem,
  onUpdateOrderItem,
}: OrderItemsSectionProps): React.ReactElement {
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    editIndex: null,
    editData: null,
  });

  const openAddDialog = useCallback(() => {
    setDialog({ open: true, editIndex: null, editData: null });
  }, []);

  const openEditDialog = useCallback(
    (index: number) => {
      const item = orderItems[index];
      if (!item) return;
      setDialog({
        open: true,
        editIndex: index,
        editData: {
          productId: item.productId,
          productName: item.productName,
          productImageUrl: item.productImageUrl ?? null,
          productSku: item.productSku,
          variantLabel: item.variantLabel,
          selectedOptionsSnapshot: item.selectedOptionsSnapshot ?? [],
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost ?? null,
        },
      });
    },
    [orderItems],
  );

  const closeDialog = useCallback(() => {
    setDialog({ open: false, editIndex: null, editData: null });
  }, []);

  const handleDialogSubmit = useCallback(
    (input: CreateOrderItemInput) => {
      if (dialog.editIndex !== null) {
        onUpdateOrderItem(dialog.editIndex, input);
      } else {
        onAddOrderItem(input);
      }
    },
    [dialog.editIndex, onAddOrderItem, onUpdateOrderItem],
  );

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
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={openAddDialog}
        >
          新增明細
        </Button>
      </Box>

      {orderItems.length === 0 ? (
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
                <TableCell align="right">數量</TableCell>
                <TableCell align="right">單價</TableCell>
                <TableCell align="right">小計</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orderItems.map((item, index) => (
                <OrderItemRow
                  key={item.tempId}
                  item={item}
                  index={index}
                  onEdit={() => openEditDialog(index)}
                  onRemove={() => onRemoveOrderItem(index)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {orderItems.length > 0 && (
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
            總金額：{formatCurrency(totalAmount)}
          </Typography>
        </Box>
      )}

      <OrderItemDialog
        open={dialog.open}
        editData={dialog.editData}
        onClose={closeDialog}
        onSubmit={handleDialogSubmit}
      />
    </Paper>
  );
}
