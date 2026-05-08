import { useMarkLineItemOrdered } from "@/hooks/useOrders";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { LineItem } from "@shared/models";
import { formatOrderDate } from "./orderTableUtils";

const LINE_ITEM_STATUS_FLAGS = [
  {
    key: "ordered",
    getLabel: (checked: boolean) => (checked ? "訂貨" : "未訂貨"),
    isChecked: (item: LineItem) => Boolean(item.orderedAt),
    checkedColor: "warning.main",
  },
  {
    key: "received",
    getLabel: (checked: boolean, item: LineItem) =>
      checked && item.receivedAt ? formatOrderDate(item.receivedAt) : "未到貨",
    isChecked: (item: LineItem) => Boolean(item.receivedAt),
    checkedColor: "info.main",
    uncheckedColor: "text.secondary",
  },
  {
    key: "shipped",
    getLabel: (checked: boolean, item: LineItem) =>
      checked && item.shippedAt ? formatOrderDate(item.shippedAt) : "未出貨",
    isChecked: (item: LineItem) => Boolean(item.shippedAt),
    checkedColor: "success.main",
    uncheckedColor: "text.secondary",
  },
  {
    key: "outOfStock",
    getLabel: (checked: boolean) => (checked ? "斷貨" : "未斷貨"),
    isChecked: () => false,
    checkedColor: "error.main",
    uncheckedColor: "text.secondary",
  },
];

export interface OrderLineItemTableRowProps {
  item: LineItem;
  orderId: string;
  orderSortKey: string;
}

export function OrderLineItemTableRow({
  item,
  orderId,
  orderSortKey,
}: OrderLineItemTableRowProps): React.ReactElement {
  const markLineItemOrdered = useMarkLineItemOrdered();

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
      {LINE_ITEM_STATUS_FLAGS.map((flag) => {
        const checked = flag.isChecked(item);
        const label = flag.getLabel(checked, item);
        const color = checked ? flag.checkedColor : flag.uncheckedColor;
        const isOrderedFlag = flag.key === "ordered";

        return (
          <TableCell key={flag.key} align="center">
            <FormControlLabel
              control={
                <Checkbox
                  checked={checked}
                  readOnly={!isOrderedFlag}
                  disabled={
                    isOrderedFlag
                      ? checked || markLineItemOrdered.isPending
                      : undefined
                  }
                  onChange={
                    isOrderedFlag
                      ? (_event, nextChecked) => {
                          if (!nextChecked) return;
                          markLineItemOrdered.mutate({
                            orderId,
                            orderSortKey,
                            lineItemId: item.id,
                          });
                        }
                      : undefined
                  }
                  size="small"
                  slotProps={{ input: { "aria-label": label } }}
                  sx={
                    color
                      ? {
                          color,
                          "&.Mui-checked": {
                            color,
                          },
                        }
                      : undefined
                  }
                />
              }
              label={label}
              sx={{
                m: 0,
                "& .MuiFormControlLabel-label": {
                  color,
                  fontSize: 14,
                },
              }}
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
}
