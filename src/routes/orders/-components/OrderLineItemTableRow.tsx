import { StatusChip } from "@/components/StatusChip";
import { useUpdateLineItemStatusFlag } from "@/hooks/useOrders";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { LineItem } from "@shared/models";
import { LINE_ITEM_STATUS_COLOR } from "./orderTableUtils";

type EditableStatusFlag = "ordered" | "received" | "shipped" | "outOfStock";

type LineItemStatusFlagConfig = {
  key: EditableStatusFlag;
  getLabel: (checked: boolean) => string;
  isChecked: (item: LineItem) => boolean;
  checkedColor: string;
  uncheckedColor?: string;
};

const LINE_ITEM_STATUS_FLAGS: LineItemStatusFlagConfig[] = [
  {
    key: "ordered",
    getLabel: (checked: boolean) => (checked ? "訂貨" : "未訂貨"),
    isChecked: (item: LineItem) => Boolean(item.orderedAt),
    checkedColor: "warning.main",
  },
  {
    key: "received",
    getLabel: (checked: boolean) => (checked ? "到貨" : "未到貨"),
    isChecked: (item: LineItem) => Boolean(item.receivedAt),
    checkedColor: "info.main",
    uncheckedColor: "text.secondary",
  },
  {
    key: "shipped",
    getLabel: (checked: boolean) => (checked ? "出貨" : "未出貨"),
    isChecked: (item: LineItem) => Boolean(item.shippedAt),
    checkedColor: "success.main",
    uncheckedColor: "text.secondary",
  },
  {
    key: "outOfStock",
    getLabel: (checked: boolean) => (checked ? "斷貨" : "未斷貨"),
    isChecked: (item: LineItem) => item.status === "缺貨",
    checkedColor: "error.main",
    uncheckedColor: "text.secondary",
  },
];

const NON_CANCELABLE_ORDERED_STATUSES = new Set<LineItem["status"]>([
  "已收到",
  "已出貨",
  "缺貨",
]);

const NON_CANCELABLE_RECEIVED_STATUSES = new Set<LineItem["status"]>([
  "已出貨",
  "缺貨",
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
  item: LineItem,
  checked: boolean,
): boolean {
  if (flag === "ordered") {
    if (checked) {
      return NON_CANCELABLE_ORDERED_STATUSES.has(item.status);
    }
    return item.status === "缺貨";
  }

  if (flag === "received") {
    if (checked) {
      return NON_CANCELABLE_RECEIVED_STATUSES.has(item.status);
    }
    return item.status !== "已訂購";
  }

  if (flag === "shipped") {
    if (checked) {
      return item.status === "缺貨";
    }
    return item.status !== "已收到";
  }

  if (checked) {
    return item.status !== "缺貨";
  }
  return item.status !== "待處理" && item.status !== "已訂購";
}

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
  const updateLineItemStatusFlag = useUpdateLineItemStatusFlag();

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
      <TableCell align="center">
        <StatusChip status={item.status} colorMap={LINE_ITEM_STATUS_COLOR} />
      </TableCell>
      {LINE_ITEM_STATUS_FLAGS.map((flag) => {
        const checked = flag.isChecked(item);
        const label = flag.getLabel(checked);
        const color = checked ? flag.checkedColor : flag.uncheckedColor;
        const editableFlag = isEditableStatusFlag(flag.key) ? flag.key : null;
        const disabled =
          editableFlag === null ||
          isStatusFlagDisabled(editableFlag, item, checked) ||
          updateLineItemStatusFlag.isPending;

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
                          updateLineItemStatusFlag.mutate({
                            orderId,
                            orderSortKey,
                            lineItemId: item.id,
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
