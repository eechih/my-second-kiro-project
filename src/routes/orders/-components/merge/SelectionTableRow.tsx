import { StatusChip } from "@/components/StatusChip";
import { useOrder } from "@/hooks/useOrders";
import { formatCurrency } from "@/lib/currency";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { ORDER_STATUS_LABEL } from "@shared/models";
import type { Order } from "@shared/models";
import { useEffect } from "react";

const MERGEABLE_ORDER_STATUS_COLOR: Record<string, "warning" | "info"> = {
  PENDING: "warning",
  ORDERED: "info",
};

export interface SelectionTableRowProps {
  orderId: string;
  selected: boolean;
  selectedCustomerId: string;
  onToggle: (orderId: string) => void;
  onOrderLoaded: (order: Order) => void;
}

export function SelectionTableRow({
  orderId,
  selected,
  selectedCustomerId,
  onToggle,
  onOrderLoaded,
}: SelectionTableRowProps): React.ReactElement | null {
  const { data: order, isLoading, error } = useOrder(orderId);

  useEffect(() => {
    if (order) onOrderLoaded(order);
  }, [order, onOrderLoaded]);

  if (isLoading) {
    return (
      <TableRow hover>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} disabled />
        </TableCell>
        <TableCell colSpan={5}>
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
        <TableCell padding="checkbox">
          <Checkbox checked={selected} disabled />
        </TableCell>
        <TableCell colSpan={5}>
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢訂單失敗"}
          </Alert>
        </TableCell>
      </TableRow>
    );
  }

  if (
    order.customerId !== selectedCustomerId ||
    (order.status !== "PENDING" && order.status !== "ORDERED")
  ) {
    return null;
  }

  return (
    <TableRow
      hover
      onClick={() => onToggle(order.id)}
      sx={{ cursor: "pointer" }}
    >
      <TableCell padding="checkbox">
        <Checkbox checked={selected} />
      </TableCell>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell align="center">
        <StatusChip
          status={order.status}
          label={ORDER_STATUS_LABEL[order.status]}
          colorMap={MERGEABLE_ORDER_STATUS_COLOR}
        />
      </TableCell>
      <TableCell align="right">{formatCurrency(order.totalAmount)}</TableCell>
      <TableCell>{order.items.length} 項</TableCell>
      <TableCell>
        {order.createdAt
          ? new Date(order.createdAt).toLocaleDateString("zh-TW")
          : ""}
      </TableCell>
    </TableRow>
  );
}
