import { StatusChip } from "@/components/StatusChip";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Order } from "@shared/models";
import {
  formatOrderDate,
  formatOrderTime,
  ORDER_STATUS_LABEL,
} from "./orderTableUtils";

export interface OrderMainTableRowProps {
  order: Order;
  onEdit: (orderId: string) => void;
}

export function OrderMainTableRow({
  order,
  onEdit,
}: OrderMainTableRowProps): React.ReactElement {
  return (
    <TableRow hover sx={{ "& > *": { borderBottom: "unset" } }}>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell>{order.customerName}</TableCell>
      <TableCell>
        <Box>
          <Typography variant="body2">
            {formatOrderDate(order.createdAt)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatOrderTime(order.createdAt)}
          </Typography>
        </Box>
      </TableCell>
      <TableCell align="center">
        <StatusChip
          status={ORDER_STATUS_LABEL[order.status] ?? order.status}
          colorMap={{
            待處理: "warning",
            已確認: "info",
            出貨中: "primary",
            已完成: "success",
            已取消: "error",
          }}
        />
      </TableCell>
      <TableCell align="right">${order.totalAmount.toLocaleString()}</TableCell>
      <TableCell align="center">
        <Tooltip title="編輯">
          <IconButton size="small" onClick={() => onEdit(order.id)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}
