import { StatusChip } from "@/components/StatusChip";
import { formatCurrency } from "@/lib/currency";
import { useUpdateOrderItemStatusFlag } from "@/hooks/useOrders";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { ORDER_ITEM_STATUS_LABEL, type OrderItem } from "@shared/models";
import { ORDER_ITEM_STATUS_COLOR } from "./tableUtils";

type EditableStatusFlag = "ordered" | "received" | "shipped" | "outOfStock";

type OrderItemStatusFlagConfig = {
  key: EditableStatusFlag;
  getLabel: (checked: boolean) => string;
  isChecked: (item: OrderItem) => boolean;
  checkedColor: string;
  uncheckedColor?: string;
};

const LINE_ITEM_STATUS_FLAGS: OrderItemStatusFlagConfig[] = [
  {
    key: "ordered",
    getLabel: (checked: boolean) => (checked ? "訂貨" : "未訂貨"),
    isChecked: (item: OrderItem) => Boolean(item.purchasedAt),
    checkedColor: "warning.main",
  },
  {
    key: "received",
    getLabel: (checked: boolean) => (checked ? "到貨" : "未到貨"),
    isChecked: (item: OrderItem) => Boolean(item.receivedAt),
    checkedColor: "info.main",
    uncheckedColor: "text.secondary",
  },
  {
    key: "shipped",
    getLabel: (checked: boolean) => (checked ? "出貨" : "未出貨"),
    isChecked: (item: OrderItem) => Boolean(item.shippedAt),
    checkedColor: "success.main",
    uncheckedColor: "text.secondary",
  },
  {
    key: "outOfStock",
    getLabel: (checked: boolean) => (checked ? "斷貨" : "未斷貨"),
    isChecked: (item: OrderItem) => item.status === "OUT_OF_STOCK",
    checkedColor: "error.main",
    uncheckedColor: "text.secondary",
  },
];

const NON_CANCELABLE_ORDERED_STATUSES = new Set<OrderItem["status"]>([
  "RECEIVED",
  "SHIPPED",
  "OUT_OF_STOCK",
]);

const NON_CANCELABLE_RECEIVED_STATUSES = new Set<OrderItem["status"]>([
  "SHIPPED",
  "OUT_OF_STOCK",
]);

function isEditableStatusFlag(key: string): key is EditableStatusFlag {
  return (
    key === "ordered" ||
    key === "received" ||
    key === "shipped" ||
    key === "outOfStock"
  );
}

function isStatusFlagDisabled(
  flag: EditableStatusFlag,
  item: OrderItem,
  checked: boolean,
): boolean {
  if (flag === "ordered") {
    if (checked) {
      return NON_CANCELABLE_ORDERED_STATUSES.has(item.status);
    }
    return item.status === "OUT_OF_STOCK";
  }

  if (flag === "received") {
    if (checked) {
      return NON_CANCELABLE_RECEIVED_STATUSES.has(item.status);
    }
    return item.status !== "ORDERED";
  }

  if (flag === "shipped") {
    if (checked) {
      return item.status === "OUT_OF_STOCK";
    }
    return item.status !== "RECEIVED";
  }

  if (checked) {
    return item.status !== "OUT_OF_STOCK";
  }
  return (
    item.status !== "PENDING" &&
    item.status !== "ORDERED" &&
    item.status !== "RECEIVED"
  );
}

export interface OrderItemRowProps {
  item: OrderItem;
  orderId: string;
}

export function OrderItemRow({
  item,
  orderId,
}: OrderItemRowProps): React.ReactElement {
  const updateOrderItemStatusFlag = useUpdateOrderItemStatusFlag();

  const variantLabel =
    item.selectedOptionsSnapshot
      ?.map((opt) => opt.valueName)
      .join(" / ") || null;

  return (
    <TableRow
      sx={{
        "&:last-child td": { borderBottom: 0 },
        "& .MuiTableCell-root": { padding: "10px 5px" },
      }}
    >
      <TableCell sx={{ width: 330, minWidth: 330, maxWidth: 330 }}>
        <Typography variant="body2">{item.productNameSnapshot}</Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 150 }}>
        {variantLabel ? (
          <Chip label={variantLabel} size="small" variant="outlined" />
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell align="right" sx={{ width: 50, minWidth: 50, maxWidth: 50 }}>
        {item.quantity}
      </TableCell>
      <TableCell align="right" sx={{ width: 60, minWidth: 60, maxWidth: 60 }}>
        {formatCurrency(item.unitPriceSnapshot)}
      </TableCell>
      <TableCell align="center">
        <StatusChip
          status={item.status}
          label={ORDER_ITEM_STATUS_LABEL[item.status]}
          colorMap={ORDER_ITEM_STATUS_COLOR}
        />
      </TableCell>
      {LINE_ITEM_STATUS_FLAGS.map((flag) => {
        const checked = flag.isChecked(item);
        const label = flag.getLabel(checked);
        const color = checked ? flag.checkedColor : flag.uncheckedColor;
        const editableFlag = isEditableStatusFlag(flag.key) ? flag.key : null;
        const disabled =
          editableFlag === null ||
          isStatusFlagDisabled(editableFlag, item, checked) ||
          updateOrderItemStatusFlag.isPending;

        return (
          <TableCell key={flag.key} align="center">
            <FormControlLabel
              control={
                <Checkbox
                  checked={checked}
                  readOnly={editableFlag === null}
                  disabled={disabled}
                  onChange={
                    editableFlag !== null
                      ? (_event, nextChecked) => {
                          updateOrderItemStatusFlag.mutate({
                            orderId,
                            orderItemId: item.id,
                            flag: editableFlag,
                            checked: nextChecked,
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
                  color: disabled ? "text.disabled" : color,
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
