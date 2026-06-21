import { StatusChip } from "@/components/StatusChip";
import { formatCurrency } from "@/lib/currency";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  ORDER_ITEM_STATUS_LABEL,
  type OrderItem,
  type Order,
} from "@shared/models";
import { useState } from "react";
import { formatDate, ORDER_ITEM_STATUS_COLOR_MAP } from "./detailUtils";

export interface OrderItemRowProps {
  orderItem: OrderItem;
  order: Order;
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function OrderItemRow({
  orderItem,
  order: _order,
  canEdit = false,
  onEdit,
  onDelete,
}: OrderItemRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const variantLabel =
    orderItem.selectedOptionsSnapshot
      ?.map((opt) => opt.valueName)
      .join(" / ") || null;

  const showActions = canEdit && orderItem.status === "PENDING";

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{orderItem.productNameSnapshot}</TableCell>
        <TableCell>{variantLabel ?? "—"}</TableCell>
        <TableCell align="right">{orderItem.quantity}</TableCell>
        <TableCell align="right">
          {formatCurrency(orderItem.unitPriceSnapshot)}
        </TableCell>
        <TableCell align="right">{formatCurrency(orderItem.subtotalAmount)}</TableCell>
        <TableCell>
          <Typography
            variant="body2"
            color={orderItem.supplierName ? "text.primary" : "text.secondary"}
          >
            {orderItem.supplierName ?? "—"}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography
            variant="body2"
            color={
              orderItem.unitCostSnapshot != null ? "text.primary" : "text.secondary"
            }
          >
            {orderItem.unitCostSnapshot != null
              ? formatCurrency(orderItem.unitCostSnapshot)
              : "—"}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <StatusChip
            status={orderItem.status}
            label={ORDER_ITEM_STATUS_LABEL[orderItem.status]}
            colorMap={ORDER_ITEM_STATUS_COLOR_MAP}
          />
        </TableCell>
        <TableCell align="center">
          {showActions && (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
              <Tooltip title="編輯">
                <IconButton size="small" onClick={onEdit}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="刪除">
                <IconButton size="small" color="error" onClick={onDelete}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell sx={{ py: 0 }} colSpan={10}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                相關日期
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                採購日期：{formatDate(orderItem.purchasedAt)} 收到日期：
                {formatDate(orderItem.receivedAt)} 出貨日期：
                {formatDate(orderItem.shippedAt)} 缺貨日期：
                {formatDate(orderItem.outOfStockAt)}
              </Typography>

              {orderItem.supplierName && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  供應商：{orderItem.supplierName} 單位成本：
                  {orderItem.unitCostSnapshot != null
                    ? formatCurrency(orderItem.unitCostSnapshot)
                    : "—"}
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
