import Chip from "@mui/material/Chip";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { LineItem } from "@shared/models";
import { LINE_ITEM_STATUS_COLOR } from "./orderTableUtils";

export interface OrderLineItemTableRowProps {
  item: LineItem;
}

export function OrderLineItemTableRow({
  item,
}: OrderLineItemTableRowProps): React.ReactElement {
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
