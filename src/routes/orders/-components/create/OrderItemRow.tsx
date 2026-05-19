import { formatCurrency } from "@/lib/currency";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { calculateOrderItemSubtotal } from "@shared/logic/order-calculations";
import type { OrderItemFormData } from "./formTypes";

export interface OrderItemRowProps {
  item: OrderItemFormData;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}

export function OrderItemRow({
  item,
  index,
  onEdit,
  onRemove,
}: OrderItemRowProps): React.ReactElement {
  const subtotal = calculateOrderItemSubtotal(item.quantity, item.unitPrice);

  return (
    <TableRow hover sx={{ cursor: "pointer" }} onClick={onEdit}>
      <TableCell sx={{ width: 40 }}>{index + 1}</TableCell>
      <TableCell sx={{ minWidth: 200 }}>
        <Typography variant="body2">{item.productName}</Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 120 }}>
        {item.variantLabel ? (
          <Typography variant="body2">{item.variantLabel}</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell align="right" sx={{ width: 80 }}>
        {item.quantity}
      </TableCell>
      <TableCell align="right" sx={{ width: 100 }}>
        {formatCurrency(item.unitPrice)}
      </TableCell>
      <TableCell align="right" sx={{ width: 100 }}>
        {formatCurrency(subtotal)}
      </TableCell>
      <TableCell sx={{ width: 80 }} align="center">
        <Tooltip title="編輯">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="刪除">
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}
