import { CursorPagination } from "@/components/CursorPagination";
import { StatusChip } from "@/components/StatusChip";
import {
  useSupplierOrderItemList,
  useUpdateOrderItemStatusFlag,
} from "@/hooks/useOrders";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { formatCurrency } from "@/lib/currency";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import {
  ORDER_ITEM_STATUS_LABEL,
  type OrderItem,
} from "@shared/models";
import {
  ORDER_ITEM_STATUS_COLOR_MAP,
  ORDER_STATUS_COLOR_MAP,
  ORDER_STATUS_LABEL,
} from "../../orders/-components/detail/detailUtils";

type SupplierReceivingStatusFilter = "all" | "ordered" | "received";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "待入庫與已入庫" },
  { value: "ordered", label: "待入庫" },
  { value: "received", label: "已入庫" },
] as const satisfies readonly {
  value: SupplierReceivingStatusFilter;
  label: string;
}[];

const PAGE_SIZE = 10;

function formatDate(value: string | null): string {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function canToggleReceived(item: OrderItem): boolean {
  return item.status === "ORDERED" || item.status === "RECEIVED";
}

export interface SupplierReceivingTableProps {
  supplierName: string;
}

export function SupplierReceivingTable({
  supplierName,
}: SupplierReceivingTableProps): React.ReactElement {
  const {
    currentToken,
    pageSize,
    tokenStack,
    goNext,
    goPrev,
    setPageSize,
    reset,
  } = useCursorPagination(PAGE_SIZE);
  const [statusFilter, setStatusFilter] =
    useState<SupplierReceivingStatusFilter>("all");
  const updateStatusFlag = useUpdateOrderItemStatusFlag();
  const statusFilterMap: Record<SupplierReceivingStatusFilter, "ORDERED" | "RECEIVED" | undefined> = {
    all: undefined,
    ordered: "ORDERED",
    received: "RECEIVED",
  };
  const { data, isLoading, error } = useSupplierOrderItemList({
    supplierName,
    pageSize,
    nextToken: currentToken,
    status: statusFilterMap[statusFilter],
  });

  useEffect(() => {
    reset();
  }, [reset, statusFilter, supplierName]);

  const records = useMemo(() => data?.items ?? [], [data?.items]);
  const summary = useMemo(
    () =>
      records.reduce(
        (acc, record) => {
          if (record.item.status === "ORDERED") acc.ordered += 1;
          if (record.item.status === "RECEIVED") acc.received += 1;
          return acc;
        },
        { ordered: 0, received: 0 },
      ),
    [records],
  );

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            入庫管理
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            依供應商查看已訂貨與已入庫明細，直接完成入庫確認。
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            select
            size="small"
            label="狀態"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as SupplierReceivingStatusFilter,
              )
            }
            sx={{ minWidth: 180 }}
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
        <Alert severity="info" sx={{ py: 0 }}>
          待入庫 {summary.ordered} 筆
        </Alert>
        <Alert severity="success" sx={{ py: 0 }}>
          已入庫 {summary.received} 筆
        </Alert>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "查詢供應商入庫資料失敗"}
        </Alert>
      ) : null}

      {isLoading ? (
        <Paper
          variant="outlined"
          sx={{ display: "flex", justifyContent: "center", py: 6 }}
        >
          <CircularProgress />
        </Paper>
      ) : records.length === 0 ? (
        <Paper variant="outlined" sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有屬於「{supplierName}」的入庫明細
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table sx={{ minWidth: 1120 }}>
              <TableHead>
                <TableRow>
                  <TableCell>訂單編號</TableCell>
                  <TableCell>客戶</TableCell>
                  <TableCell>商品</TableCell>
                  <TableCell>規格</TableCell>
                  <TableCell align="right">數量</TableCell>
                  <TableCell align="right">採購成本</TableCell>
                  <TableCell align="center">明細狀態</TableCell>
                  <TableCell align="center">訂單狀態</TableCell>
                  <TableCell align="center">訂貨日期</TableCell>
                  <TableCell align="center">到貨日期</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.item.id} hover>
                    <TableCell>{record.orderNumber}</TableCell>
                    <TableCell>{record.customerName}</TableCell>
                    <TableCell>{record.item.productNameSnapshot}</TableCell>
                    <TableCell>{record.item.selectedOptionsSnapshot?.map((opt) => opt.valueName).join(" / ") || "-"}</TableCell>
                    <TableCell align="right">{record.item.quantity}</TableCell>
                    <TableCell align="right">
                      {record.item.unitCostSnapshot != null
                        ? formatCurrency(record.item.unitCostSnapshot)
                        : "-"}
                    </TableCell>
                    <TableCell align="center">
                      <StatusChip
                        status={record.item.status}
                        label={ORDER_ITEM_STATUS_LABEL[record.item.status]}
                        colorMap={ORDER_ITEM_STATUS_COLOR_MAP}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <StatusChip
                        status={record.orderStatus}
                        label={ORDER_STATUS_LABEL[record.orderStatus]}
                        colorMap={ORDER_STATUS_COLOR_MAP}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {formatDate(record.item.purchasedAt)}
                    </TableCell>
                    <TableCell align="center">
                      {formatDate(record.item.receivedAt)}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant={
                          record.item.receivedAt ? "contained" : "outlined"
                        }
                        color="info"
                        disabled={
                          !canToggleReceived(record.item) ||
                          updateStatusFlag.isPending
                        }
                        onClick={() =>
                          updateStatusFlag.mutate({
                            orderId: record.orderId,
                            orderItemId: record.item.id,
                            flag: "received",
                            checked: !record.item.receivedAt,
                          })
                        }
                      >
                        {record.item.receivedAt ? "取消入庫" : "確認入庫"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <CursorPagination
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            hasNextPage={!!data?.nextToken}
            hasPrevPage={tokenStack.length > 0}
            onNextPage={() => {
              if (data?.nextToken) goNext(data.nextToken);
            }}
            onPrevPage={goPrev}
            currentCount={records.length}
          />
        </>
      )}
    </Paper>
  );
}
