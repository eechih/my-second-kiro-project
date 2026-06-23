import { StatusChip } from "@/components/StatusChip";
import {
  useAllSupplierOrderItems,
  useUpdateOrderItemStatusFlag,
  type ProductOrderItemRecord,
} from "@/hooks/useOrders";
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
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ORDER_ITEM_STATUS_LABEL } from "@shared/models";
import { useMemo, useState } from "react";
import { ORDER_ITEM_STATUS_COLOR_MAP } from "../../orders/-components/detail/detailUtils";

type StatusFilter = "all" | "ordered" | "received";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "ordered", label: "待入庫" },
  { value: "received", label: "已入庫" },
] as const satisfies readonly { value: StatusFilter; label: string }[];

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function canToggleReceived(record: ProductOrderItemRecord): boolean {
  return record.item.status === "ORDERED" || record.item.status === "RECEIVED";
}

export interface SupplierReceivingTableProps {
  supplierName: string;
  initialStatusFilter?: StatusFilter;
}

export function SupplierReceivingTable({
  supplierName,
  initialStatusFilter = "all",
}: SupplierReceivingTableProps): React.ReactElement {
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>(initialStatusFilter);
  const statusMap: Record<StatusFilter, "ORDERED" | "RECEIVED" | undefined> = {
    all: undefined,
    ordered: "ORDERED",
    received: "RECEIVED",
  };
  const {
    data: records,
    isLoading,
    error,
  } = useAllSupplierOrderItems({
    supplierName,
    status: statusMap[statusFilter],
  });
  const updateStatusFlag = useUpdateOrderItemStatusFlag();
  const isBusy = updateStatusFlag.isPending;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const selectableRecords = useMemo(
    () => (records ?? []).filter(canToggleReceived),
    [records],
  );
  const selectedRecords = useMemo(
    () => (records ?? []).filter((r) => selectedIds.has(r.orderId)),
    [records, selectedIds],
  );
  const confirmCandidates = selectedRecords.filter(
    (r) => r.item.status === "ORDERED",
  );
  const cancelCandidates = selectedRecords.filter(
    (r) => r.item.status === "RECEIVED",
  );
  const isAllSelected =
    selectableRecords.length > 0 &&
    selectableRecords.every((r) => selectedIds.has(r.orderId));
  const isSomeSelected = selectableRecords.some((r) =>
    selectedIds.has(r.orderId),
  );

  const summary = useMemo(
    () =>
      (records ?? []).reduce(
        (acc, r) => {
          if (r.item.status === "ORDERED") acc.ordered += 1;
          if (r.item.status === "RECEIVED") acc.received += 1;
          return acc;
        },
        { ordered: 0, received: 0 },
      ),
    [records],
  );

  const totalCount = (records ?? []).length;
  const pagedRecords = useMemo(() => {
    const start = page * rowsPerPage;
    return (records ?? []).slice(start, start + rowsPerPage);
  }, [records, page, rowsPerPage]);

  const handleToggleAll = (checked: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of selectableRecords) {
        if (checked) next.add(r.orderId);
        else next.delete(r.orderId);
      }
      return next;
    });
  };

  const runBatch = async (
    targets: readonly ProductOrderItemRecord[],
    checked: boolean,
    actionKey: string,
  ): Promise<void> => {
    if (targets.length === 0 || isBusy) return;
    setBusyAction(actionKey);
    try {
      await updateStatusFlag.mutateAsync({
        orderIds: targets.map((r) => r.orderId),
        flag: "received",
        checked,
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of targets) next.delete(r.orderId);
        return next;
      });
    } finally {
      setBusyAction(null);
    }
  };

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
            待入庫 {summary.ordered} 筆、已入庫 {summary.received} 筆
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          label="狀態"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter);
            setPage(0);
          }}
          sx={{ minWidth: 160 }}
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "查詢供應商入庫資料失敗"}
        </Alert>
      ) : null}

      {selectedRecords.length > 0 ? (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", flexWrap: "wrap", mb: 1.5 }}
        >
          <Typography variant="caption" sx={{ mr: 1 }}>
            已選 {selectedRecords.length} 筆：
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="info"
            disabled={confirmCandidates.length === 0 || isBusy}
            startIcon={
              busyAction === "batch-confirm" ? (
                <CircularProgress size={14} />
              ) : undefined
            }
            onClick={() =>
              void runBatch(confirmCandidates, true, "batch-confirm")
            }
          >
            確認入庫 {confirmCandidates.length}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="info"
            disabled={cancelCandidates.length === 0 || isBusy}
            startIcon={
              busyAction === "batch-cancel" ? (
                <CircularProgress size={14} />
              ) : undefined
            }
            onClick={() =>
              void runBatch(cancelCandidates, false, "batch-cancel")
            }
          >
            取消入庫 {cancelCandidates.length}
          </Button>
        </Stack>
      ) : null}

      {isLoading ? (
        <Paper
          variant="outlined"
          sx={{ display: "flex", justifyContent: "center", py: 6 }}
        >
          <CircularProgress />
        </Paper>
      ) : (records ?? []).length === 0 ? (
        <Paper variant="outlined" sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有屬於「{supplierName}」的入庫明細
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate = !isAllSelected && isSomeSelected;
                      }}
                      disabled={selectableRecords.length === 0 || isBusy}
                      onChange={(e) => handleToggleAll(e.target.checked)}
                      aria-label="全選"
                    />
                  </TableCell>
                  <TableCell>訂單編號</TableCell>
                  <TableCell>客戶</TableCell>
                  <TableCell>商品</TableCell>
                  <TableCell>規格</TableCell>
                  <TableCell align="right">數量</TableCell>
                  <TableCell align="right">成本</TableCell>
                  <TableCell align="center">狀態</TableCell>
                  <TableCell align="center">訂貨日</TableCell>
                  <TableCell align="center">到貨日</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedRecords.map((record) => {
                  const { item } = record;
                  const canToggle = canToggleReceived(record);
                  const isLoading = busyAction === `row-${record.orderId}`;

                  return (
                    <TableRow
                      key={record.orderId}
                      hover
                      selected={selectedIds.has(record.orderId)}
                    >
                      <TableCell padding="checkbox">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.orderId)}
                          disabled={!canToggle || isBusy}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(record.orderId);
                              else next.delete(record.orderId);
                              return next;
                            });
                          }}
                          aria-label={`選取訂單 ${record.orderNumber}`}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {record.orderNumber}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {record.customerName}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {item.productNameSnapshot}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {item.selectedOptionsSnapshot
                          ?.map((opt) => opt.valueName)
                          .join(" / ") || "-"}
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">
                        {item.unitCostSnapshot != null
                          ? formatCurrency(item.unitCostSnapshot)
                          : "-"}
                      </TableCell>
                      <TableCell align="center">
                        <StatusChip
                          status={item.status}
                          label={ORDER_ITEM_STATUS_LABEL[item.status]}
                          colorMap={ORDER_ITEM_STATUS_COLOR_MAP}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {formatDate(item.purchasedAt)}
                      </TableCell>
                      <TableCell align="center">
                        {formatDate(item.receivedAt)}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant={item.receivedAt ? "contained" : "outlined"}
                          color="info"
                          disabled={!canToggle || isBusy}
                          startIcon={
                            isLoading ? (
                              <CircularProgress size={12} />
                            ) : undefined
                          }
                          sx={{ minWidth: 0, px: 1 }}
                          onClick={() => {
                            setBusyAction(`row-${record.orderId}`);
                            updateStatusFlag.mutate(
                              {
                                orderId: record.orderId,
                                orderItemId: item.id,
                                flag: "received",
                                checked: !item.receivedAt,
                              },
                              { onSettled: () => setBusyAction(null) },
                            );
                          }}
                        >
                          {item.receivedAt ? "取消入庫" : "確認入庫"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="每頁筆數"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}–${to} / 共 ${count} 筆`
            }
          />
        </>
      )}
    </Paper>
  );
}
