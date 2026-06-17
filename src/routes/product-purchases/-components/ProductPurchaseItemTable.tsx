import { StatusChip } from "@/components/StatusChip";
import { formatCurrency } from "@/lib/currency";
import {
  useUpdateOrderItemStatusFlag,
  type ProductOrderItemRecord,
} from "@/hooks/useOrders";
import {
  ORDER_ITEM_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  type OrderItem,
} from "@shared/models";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  ORDER_ITEM_STATUS_COLOR_MAP,
} from "../../orders/-components/detail/detailUtils";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function canToggleOrdered(record: ProductOrderItemRecord): boolean {
  if (record.orderStatus === "CANCELLED") {
    return false;
  }

  return record.item.status === "pending" || record.item.status === "ordered";
}

function canToggleOutOfStock(record: ProductOrderItemRecord): boolean {
  if (record.orderStatus === "CANCELLED") {
    return false;
  }

  const { item } = record;

  return (
    item.status === "pending" ||
    item.status === "ordered" ||
    item.status === "received" ||
    item.status === "out_of_stock"
  );
}

function canEditRecord(record: ProductOrderItemRecord): boolean {
  return (
    (record.orderStatus === "PENDING" || record.orderStatus === "ORDERED") &&
    (record.item.status === "pending" || record.item.status === "ordered")
  );
}

function getDisabledOrderStatusTooltip(record: ProductOrderItemRecord): string {
  return `訂單狀態：${ORDER_STATUS_LABEL[record.orderStatus]}`;
}

export interface ProductPurchaseItemTableProps {
  records: ProductOrderItemRecord[];
  onEdit: (record: ProductOrderItemRecord) => void;
  onDelete: (record: ProductOrderItemRecord) => void;
}

export function ProductPurchaseItemTable({
  records,
  onEdit,
  onDelete,
}: ProductPurchaseItemTableProps): React.ReactElement {
  const updateStatusFlag = useUpdateOrderItemStatusFlag();

  if (records.length === 0) {
    return (
      <Paper sx={{ py: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          目前沒有符合條件的單品採購資料
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ mt: 2, overflowX: "auto" }}
    >
      <Table sx={{ minWidth: 1440 }}>
        <TableHead>
          <TableRow>
            <TableCell>訂單編號</TableCell>
            <TableCell>客戶名稱</TableCell>
            <TableCell>規格</TableCell>
            <TableCell align="right">數量</TableCell>
            <TableCell align="right">單價</TableCell>
            <TableCell align="right">採購成本</TableCell>
            <TableCell>供應商</TableCell>
            <TableCell align="center">狀態</TableCell>
            <TableCell align="center">訂貨日期</TableCell>
            <TableCell align="center">快捷操作</TableCell>
            <TableCell align="center">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((record) => {
            const { item } = record;
            const canEdit = canEditRecord(record);

            return (
              <TableRow key={item.id} hover>
                <TableCell>{record.orderNumber}</TableCell>
                <TableCell>{record.customerName}</TableCell>
                <TableCell>{item.variantLabel || "-"}</TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right">
                  {formatCurrency(item.unitPrice)}
                </TableCell>
                <TableCell align="right">
                  {item.unitCost != null ? formatCurrency(item.unitCost) : "-"}
                </TableCell>
                <TableCell>{item.supplierName || "-"}</TableCell>
                <TableCell align="center">
                  <StatusChip
                    status={item.status}
                    label={ORDER_ITEM_STATUS_LABEL[item.status]}
                    colorMap={ORDER_ITEM_STATUS_COLOR_MAP}
                  />
                </TableCell>
                <TableCell align="center">{formatDate(item.purchasedAt)}</TableCell>
                <TableCell align="center">
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <Tooltip
                      title={
                        !canToggleOrdered(record) || updateStatusFlag.isPending
                          ? getDisabledOrderStatusTooltip(record)
                          : ""
                      }
                    >
                      <span>
                        <Button
                          size="small"
                          variant={item.purchasedAt ? "contained" : "outlined"}
                          color="warning"
                          disabled={
                            !canToggleOrdered(record) ||
                            updateStatusFlag.isPending
                          }
                          onClick={() =>
                            updateStatusFlag.mutate({
                              orderId: record.orderId,
                              orderItemId: item.id,
                              flag: "ordered",
                              checked: !item.purchasedAt,
                            })
                          }
                        >
                          {item.purchasedAt ? "取消訂貨" : "確認訂貨"}
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title={
                        !canToggleOutOfStock(record) ||
                        updateStatusFlag.isPending
                          ? getDisabledOrderStatusTooltip(record)
                          : ""
                      }
                    >
                      <span>
                        <Button
                          size="small"
                          variant={
                            item.status === "out_of_stock"
                              ? "contained"
                              : "outlined"
                          }
                          color="error"
                          disabled={
                            !canToggleOutOfStock(record) ||
                            updateStatusFlag.isPending
                          }
                          onClick={() =>
                            updateStatusFlag.mutate({
                              orderId: record.orderId,
                              orderItemId: item.id,
                              flag: "outOfStock",
                              checked: item.status !== "out_of_stock",
                            })
                          }
                        >
                          {item.status === "out_of_stock"
                            ? "取消缺貨"
                            : "標記缺貨"}
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
                    <Tooltip title="編輯">
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canEdit}
                          onClick={() => onEdit(record)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="刪除">
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canEdit}
                          onClick={() => onDelete(record)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
