import { formatCurrency } from "@/lib/currency";
import DeleteIcon from "@mui/icons-material/Delete";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { calculateLineItemSubtotal } from "@shared/logic/order-calculations";
import type { LineItemFormData } from "./formTypes";

export interface LineItemRowProps {
  item: LineItemFormData;
  index: number;
  onRemove: () => void;
  onUpdate: (updates: Partial<LineItemFormData>) => void;
}

export function LineItemRow({
  item,
  index,
  onRemove,
  onUpdate,
}: LineItemRowProps): React.ReactElement {
  const subtotal = calculateLineItemSubtotal(item.quantity, item.unitPrice);

  return (
    <TableRow>
      <TableCell sx={{ width: 40 }}>{index + 1}</TableCell>
      <TableCell sx={{ minWidth: 200 }}>
        <Typography variant="body2">{item.productName}</Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 180 }}>
        {item.variantLabel ? (
          <Typography variant="body2">{item.variantLabel}</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ width: 100 }}>
        <TextField
          type="number"
          value={item.quantity}
          onChange={(event) =>
            onUpdate({
              quantity: Math.max(1, parseInt(event.target.value, 10) || 1),
            })
          }
          size="small"
          slotProps={{ htmlInput: { min: 1 } }}
          sx={{ width: 80 }}
        />
      </TableCell>
      <TableCell sx={{ width: 120 }}>
        <TextField
          type="number"
          value={item.unitPrice}
          onChange={(event) =>
            onUpdate({
              unitPrice: Math.max(
                0,
                Math.trunc(Number(event.target.value) || 0),
              ),
            })
          }
          size="small"
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          sx={{ width: 100 }}
        />
      </TableCell>
      <TableCell sx={{ width: 100 }} align="right">
        {formatCurrency(subtotal)}
      </TableCell>
      <TableCell sx={{ width: 50 }}>
        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
