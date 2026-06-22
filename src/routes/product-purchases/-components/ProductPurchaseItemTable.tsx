import { StatusChip } from "@/components/StatusChip";
import { formatCurrency } from "@/lib/currency";
import {
  useUpdateOrderItemStatusFlag,
  type ProductOrderItemRecord,
} from "@/hooks/useOrders";
import { ORDER_ITEM_STATUS_LABEL, ORDER_STATUS_LABEL } from "@shared/models";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import UndoIcon from "@mui/icons-material/Undo";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { ORDER_ITEM_STATUS_COLOR_MAP } from "../../orders/-components/detail/detailUtils";

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

  return record.item.status === "PENDING" || record.item.status === "ORDERED";
}

function canToggleOutOfStock(record: ProductOrderItemRecord): boolean {
  if (record.orderStatus === "CANCELLED") {
    return false;
  }

  const { item } = record;

  return (
    item.status === "PENDING" ||
    item.status === "ORDERED" ||
    item.status === "OUT_OF_STOCK"
  );
}

function canEditRecord(record: ProductOrderItemRecord): boolean {
  return (
    (record.orderStatus === "PENDING" || record.orderStatus === "ORDERED") &&
    (record.item.status === "PENDING" || record.item.status === "ORDERED")
  );
}

function getDisabledOrderStatusTooltip(record: ProductOrderItemRecord): string {
  return `訂單狀態：${ORDER_STATUS_LABEL[record.orderStatus]}`;
}

function canBatchSelect(record: ProductOrderItemRecord): boolean {
  return canToggleOrdered(record) || canToggleOutOfStock(record);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchError, setBatchError] = useState<string | null>(null);
  const selectableRecords = useMemo(
    () => records.filter(canBatchSelect),
    [records],
  );
  const selectedRecords = useMemo(
    () => records.filter((record) => selectedIds.has(record.orderId)),
    [records, selectedIds],
  );
  const selectedCount = selectedRecords.length;
  const isAllVisibleSelected =
    selectableRecords.length > 0 &&
    selectableRecords.every((record) => selectedIds.has(record.orderId));
  const isSomeVisibleSelected = selectableRecords.some((record) =>
    selectedIds.has(record.orderId),
  );
  const pendingOrderRecords = selectedRecords.filter(
    (record) => canToggleOrdered(record) && record.item.status === "PENDING",
  );
  const orderedRecords = selectedRecords.filter(
    (record) => canToggleOrdered(record) && record.item.status === "ORDERED",
  );
  const outOfStockCandidates = selectedRecords.filter(
    (record) =>
      canToggleOutOfStock(record) && record.item.status !== "OUT_OF_STOCK",
  );
  const outOfStockRecords = selectedRecords.filter(
    (record) =>
      canToggleOutOfStock(record) && record.item.status === "OUT_OF_STOCK",
  );
  const isBusy = updateStatusFlag.isPending;
  const batchStatusText =
    selectedCount > 0
      ? `可批次處理：確認訂貨 ${pendingOrderRecords.length}、取消訂貨 ${orderedRecords.length}、標記缺貨 ${outOfStockCandidates.length}、取消缺貨 ${outOfStockRecords.length}`
      : "勾選明細後可批次處理確認訂貨、取消訂貨與缺貨狀態";

  const handleToggleAllVisible = (checked: boolean): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const record of selectableRecords) {
        if (checked) {
          next.add(record.orderId);
        } else {
          next.delete(record.orderId);
        }
      }
      return next;
    });
  };

  const handleToggleRecord = (
    record: ProductOrderItemRecord,
    checked: boolean,
  ): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(record.orderId);
      } else {
        next.delete(record.orderId);
      }
      return next;
    });
  };

  const runBatchAction = async (
    targets: readonly ProductOrderItemRecord[],
    action: {
      flag: "ordered" | "outOfStock";
      checked: boolean;
      fallbackMessage: string;
    },
  ): Promise<void> => {
    if (targets.length === 0 || isBusy) {
      return;
    }

    setBatchError(null);

    try {
      await updateStatusFlag.mutateAsync({
        orderIds: targets.map((record) => record.orderId),
        flag: action.flag,
        checked: action.checked,
      });

      setSelectedIds((current) => {
        const next = new Set(current);
        for (const record of targets) {
          next.delete(record.orderId);
        }
        return next;
      });
    } catch (error) {
      setBatchError(
        error instanceof Error ? error.message : action.fallbackMessage,
      );
    }
  };

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
    <Stack spacing={1} sx={{ mt: 1 }}>
      {batchError ? (
        <Alert severity="error" onClose={() => setBatchError(null)}>
          {batchError}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ px: 1.5, py: 1 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={0.5}
          sx={{
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              已選取 {selectedCount} 筆
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {batchStatusText}
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              flexWrap: "wrap",
              justifyContent: { xs: "flex-start", md: "flex-end" },
            }}
          >
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={
                isBusy ? <CircularProgress size={16} /> : <CheckCircleIcon />
              }
              disabled={pendingOrderRecords.length === 0 || isBusy}
              onClick={() =>
                void runBatchAction(pendingOrderRecords, {
                  flag: "ordered",
                  checked: true,
                  fallbackMessage: "批次確認訂貨失敗",
                })
              }
            >
              批次確認 {pendingOrderRecords.length}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={isBusy ? <CircularProgress size={16} /> : <UndoIcon />}
              disabled={orderedRecords.length === 0 || isBusy}
              onClick={() =>
                void runBatchAction(orderedRecords, {
                  flag: "ordered",
                  checked: false,
                  fallbackMessage: "批次取消訂貨失敗",
                })
              }
            >
              批次取消 {orderedRecords.length}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={
                isBusy ? <CircularProgress size={16} /> : <ReportProblemIcon />
              }
              disabled={outOfStockCandidates.length === 0 || isBusy}
              onClick={() =>
                void runBatchAction(outOfStockCandidates, {
                  flag: "outOfStock",
                  checked: true,
                  fallbackMessage: "批次標記缺貨失敗",
                })
              }
            >
              批次缺貨 {outOfStockCandidates.length}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={isBusy ? <CircularProgress size={16} /> : <UndoIcon />}
              disabled={outOfStockRecords.length === 0 || isBusy}
              onClick={() =>
                void runBatchAction(outOfStockRecords, {
                  flag: "outOfStock",
                  checked: false,
                  fallbackMessage: "批次取消缺貨失敗",
                })
              }
            >
              取消缺貨 {outOfStockRecords.length}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ overflowX: "auto" }}
      >
        <Table size="small" sx={{ minWidth: 1200 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={isAllVisibleSelected}
                  indeterminate={!isAllVisibleSelected && isSomeVisibleSelected}
                  disabled={selectableRecords.length === 0 || isBusy}
                  onChange={(event) =>
                    handleToggleAllVisible(event.target.checked)
                  }
                  slotProps={{
                    input: {
                      "aria-label": "選取目前頁面可批次操作明細",
                    },
                  }}
                />
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>訂單編號</TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>客戶</TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>規格</TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                數量
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                單價
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                成本
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>供應商</TableCell>
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                狀態
              </TableCell>
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                訂貨日
              </TableCell>
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                快捷操作
              </TableCell>
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                操作
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((record) => {
              const { item } = record;
              const canEdit = canEditRecord(record);
              const canSelect = canBatchSelect(record);

              return (
                <TableRow
                  key={item.id}
                  hover
                  selected={selectedIds.has(record.orderId)}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(record.orderId)}
                      disabled={!canSelect || isBusy}
                      onChange={(event) =>
                        handleToggleRecord(record, event.target.checked)
                      }
                      slotProps={{
                        input: {
                          "aria-label": `選取訂單 ${record.orderNumber}`,
                        },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {record.orderNumber}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {record.customerName}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {item.selectedOptionsSnapshot
                      ?.map((opt) => opt.valueName)
                      .join(" / ") || "-"}
                  </TableCell>
                  <TableCell align="right">{item.quantity}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {formatCurrency(item.unitPriceSnapshot)}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {item.unitCostSnapshot != null
                      ? formatCurrency(item.unitCostSnapshot)
                      : "-"}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {item.supplierName || "-"}
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
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 0.5,
                        flexWrap: "nowrap",
                      }}
                    >
                      <Tooltip
                        title={
                          !canToggleOrdered(record) || isBusy
                            ? getDisabledOrderStatusTooltip(record)
                            : ""
                        }
                      >
                        <span>
                          <Button
                            size="small"
                            variant={
                              item.purchasedAt ? "contained" : "outlined"
                            }
                            color="warning"
                            disabled={!canToggleOrdered(record) || isBusy}
                            sx={{ minWidth: 0, px: 1, whiteSpace: "nowrap" }}
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
                          !canToggleOutOfStock(record) || isBusy
                            ? getDisabledOrderStatusTooltip(record)
                            : ""
                        }
                      >
                        <span>
                          <Button
                            size="small"
                            variant={
                              item.status === "OUT_OF_STOCK"
                                ? "contained"
                                : "outlined"
                            }
                            color="error"
                            disabled={!canToggleOutOfStock(record) || isBusy}
                            sx={{ minWidth: 0, px: 1, whiteSpace: "nowrap" }}
                            onClick={() =>
                              updateStatusFlag.mutate({
                                orderId: record.orderId,
                                orderItemId: item.id,
                                flag: "outOfStock",
                                checked: item.status !== "OUT_OF_STOCK",
                              })
                            }
                          >
                            {item.status === "OUT_OF_STOCK"
                              ? "取消缺貨"
                              : "標記缺貨"}
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 0.5,
                      }}
                    >
                      <Tooltip title="編輯">
                        <span>
                          <IconButton
                            size="small"
                            disabled={!canEdit || isBusy}
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
                            disabled={!canEdit || isBusy}
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
    </Stack>
  );
}
