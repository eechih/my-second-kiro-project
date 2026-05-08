import { listTableBodyTextSx } from "@/components/listTableStyles";
import { useOrder } from "@/hooks/useOrders";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import type { Order } from "@shared/models";
import { useEffect } from "react";
import { OrderLineItemsTable } from "./OrderLineItemsTable";
import { OrderMainTableRow } from "./OrderMainTableRow";

export interface OrderTableRowProps {
  orderId: string;
  selected?: boolean;
  onEdit: (orderId: string) => void;
  onSelectionChange?: (selected: boolean) => void;
  onOrderLoaded?: (order: Order) => void;
}

export function OrderTableRow({
  orderId,
  selected = false,
  onEdit,
  onSelectionChange,
  onOrderLoaded,
}: OrderTableRowProps): React.ReactElement {
  const { data: order, isLoading, error } = useOrder(orderId);

  useEffect(() => {
    if (order) {
      onOrderLoaded?.(order);
    }
  }, [order, onOrderLoaded]);

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
          <OrderMainTableRow
            order={order}
            selected={selected}
            onEdit={onEdit}
            onSelectionChange={onSelectionChange}
          />
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
