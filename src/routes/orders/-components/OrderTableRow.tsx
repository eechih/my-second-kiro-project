import { StatusChip } from "@/components/StatusChip";
import { useOrder } from "@/hooks/useOrders";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

const ORDER_STATUS_COLOR_MAP: Record<
  string,
  "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  pending: "warning",
  confirmed: "info",
  shipping: "primary",
  completed: "success",
  cancelled: "error",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  confirmed: "已確認",
  shipping: "出貨中",
  completed: "已完成",
  cancelled: "已取消",
};

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
    <TableRow hover>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell>{order.customerName}</TableCell>
      <TableCell>
        <Box>
          <Typography variant="body2">{formatDate(order.createdAt)}</Typography>
          <Typography variant="body2" color="text.secondary">
            {formatTime(order.createdAt)}
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
            ...ORDER_STATUS_COLOR_MAP,
          }}
        />
      </TableCell>
      <TableCell align="right">
        ${order.totalAmount.toLocaleString()}
      </TableCell>
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}
