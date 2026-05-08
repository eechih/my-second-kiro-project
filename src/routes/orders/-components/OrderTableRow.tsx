import { useOrder } from "@/hooks/useOrders";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { OrderLineItemsTable } from "./OrderLineItemsTable";
import { OrderMainTableRow } from "./OrderMainTableRow";

export interface OrderTableRowProps {
  orderId: string;
  onEdit: (orderId: string) => void;
}

export function OrderTableRow({
  orderId,
  onEdit,
}: OrderTableRowProps): React.ReactElement {
  const { data: order, isLoading, error } = useOrder(orderId);

  if (isLoading) {
    return (
      <TableRow hover>
        <TableCell colSpan={6}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography color="text.secondary">載入訂單資料中...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  if (error || !order) {
    return (
      <TableRow hover>
        <TableCell colSpan={6}>
          <Typography color="error">
            {error instanceof Error ? error.message : "查詢訂單失敗"}
          </Typography>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      <OrderMainTableRow order={order} onEdit={onEdit} />
      <OrderLineItemsTable lineItems={order.lineItems} />
    </>
  );
}
