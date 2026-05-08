import { StatusChip } from "@/components/StatusChip";
import { useOrder } from "@/hooks/useOrders";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { LineItem } from "@shared/models";

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  confirmed: "已確認",
  shipping: "出貨中",
  completed: "已完成",
  cancelled: "已取消",
};

const LINE_ITEM_STATUS_COLOR: Record<
  string,
  "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  待處理: "warning",
  已訂購: "info",
  已收到: "primary",
  已出貨: "success",
  缺貨: "error",
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
    <>
      {/* 主列 */}
      <TableRow hover sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell>{order.orderNumber}</TableCell>
        <TableCell>{order.customerName}</TableCell>
        <TableCell>
          <Box>
            <Typography variant="body2">
              {formatDate(order.createdAt)}
            </Typography>
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

      {/* 明細列（始終展開） */}
      <TableRow>
        <TableCell sx={{ py: 0 }} colSpan={6}>
          <Box sx={{ mx: 2, my: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>商品名稱</TableCell>
                  <TableCell>規格</TableCell>
                  <TableCell align="right">數量</TableCell>
                  <TableCell align="right">單價</TableCell>
                  <TableCell align="right">小計</TableCell>
                  <TableCell align="center">狀態</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.lineItems.map((item) => (
                  <LineItemRow key={item.id} item={item} />
                ))}
              </TableBody>
            </Table>
          </Box>
        </TableCell>
      </TableRow>
    </>
  );
}

function LineItemRow({ item }: { item: LineItem }): React.ReactElement {
  return (
    <TableRow sx={{ "&:last-child td": { borderBottom: 0 } }}>
      <TableCell>
        <Typography variant="body2">{item.productName}</Typography>
      </TableCell>
      <TableCell>
        {item.variantLabel ? (
          <Chip label={item.variantLabel} size="small" variant="outlined" />
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">{item.quantity}</TableCell>
      <TableCell align="right">${item.unitPrice.toLocaleString()}</TableCell>
      <TableCell align="right">${item.subtotal.toLocaleString()}</TableCell>
      <TableCell align="center">
        <Chip
          label={item.status}
          size="small"
          color={LINE_ITEM_STATUS_COLOR[item.status] ?? "default"}
        />
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
