import { listTableBodyTextSx } from "@/components/listTableStyles";
import { useOrder } from "@/hooks/useOrders";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
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
      <Paper
        variant="outlined"
        sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5 }}
      >
        <CircularProgress size={16} />
        <Typography color="text.secondary">載入訂單資料中...</Typography>
      </Paper>
    );
  }

  if (error || !order) {
    return (
      <Paper variant="outlined" sx={{ borderColor: "error.light", p: 2 }}>
        <Typography color="error">
          {error instanceof Error ? error.message : "查詢訂單失敗"}
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table
        size="small"
        sx={{
          ...listTableBodyTextSx,
          "& .MuiTableCell-root": {
            borderBottomColor: "divider",
          },
        }}
      >
        <TableBody>
          <OrderMainTableRow order={order} onEdit={onEdit} />
        </TableBody>
      </Table>
      <OrderLineItemsTable
        lineItems={order.lineItems}
        orderId={order.customerId}
        orderSortKey={order.id.split("|")[1] ?? ""}
      />
    </TableContainer>
  );
}
