import { listTableBodyTextSx } from "@/components/listTableStyles";
import { StatusChip } from "@/components/StatusChip";
import { useProductThumbnailUrls } from "@/hooks/useProductImages";
import type { ProductPurchaseSummary } from "@/hooks/useProductPurchases";
import {
  useAllProductOrderItems,
  useUpdateOrderItemStatusFlag,
  type ProductOrderItemRecord,
} from "@/hooks/useOrders";
import { formatCurrency } from "@/lib/currency";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  ORDER_ITEM_STATUS_LABEL,
  type OrderFulfillmentStatus,
} from "@shared/models";
import { useMemo, useState } from "react";
import { ORDER_ITEM_STATUS_COLOR_MAP } from "../../orders/-components/detail/detailUtils";

type SortKey = "sku" | "supplier" | "pending" | "ordered" | "lastUpdated";
type SortDirection = "asc" | "desc";

const PRODUCT_PURCHASE_STATUS_COLUMNS: readonly OrderFulfillmentStatus[] = [
  "PENDING",
  "ORDERED",
  "RECEIVED",
];

const COLUMN_COUNT = 9; // product + price + cost + supplier + 3 statuses + lastUpdated + action

function compareSummaries(
  a: ProductPurchaseSummary,
  b: ProductPurchaseSummary,
  sortKey: SortKey,
  direction: SortDirection,
): number {
  let result = 0;

  switch (sortKey) {
    case "sku":
      result = (a.productSku ?? "").localeCompare(
        b.productSku ?? "",
        "zh-Hant",
      );
      break;
    case "supplier":
      result = (a.supplierName ?? "").localeCompare(
        b.supplierName ?? "",
        "zh-Hant",
      );
      break;
    case "pending":
      result =
        (a.statusQuantities["PENDING"] ?? 0) -
        (b.statusQuantities["PENDING"] ?? 0);
      break;
    case "ordered":
      result =
        (a.statusQuantities["ORDERED"] ?? 0) -
        (b.statusQuantities["ORDERED"] ?? 0);
      break;
    case "lastUpdated":
      result = (a.latestActivityAt ?? "").localeCompare(
        b.latestActivityAt ?? "",
      );
      break;
  }

  return direction === "desc" ? -result : result;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Detail Panel (expanded row content)
// ---------------------------------------------------------------------------

function canToggleOrdered(record: ProductOrderItemRecord): boolean {
  return (
    record.orderStatus !== "CANCELLED" &&
    (record.item.status === "PENDING" || record.item.status === "ORDERED")
  );
}

function canToggleOutOfStock(record: ProductOrderItemRecord): boolean {
  return (
    record.orderStatus !== "CANCELLED" &&
    (record.item.status === "PENDING" ||
      record.item.status === "ORDERED" ||
      record.item.status === "OUT_OF_STOCK")
  );
}

function canBatchSelect(record: ProductOrderItemRecord): boolean {
  return canToggleOrdered(record) || canToggleOutOfStock(record);
}

function DetailPanel({ productId }: { productId: string }): React.ReactElement {
  const { data: records, isLoading } = useAllProductOrderItems({
    productId,
    status: "PENDING",
  });
  const updateStatusFlag = useUpdateOrderItemStatusFlag();
  const isBusy = updateStatusFlag.isPending;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const selectableRecords = useMemo(
    () => (records ?? []).filter(canBatchSelect),
    [records],
  );
  const selectedRecords = useMemo(
    () => (records ?? []).filter((r) => selectedIds.has(r.orderId)),
    [records, selectedIds],
  );
  const pendingRecords = selectedRecords.filter(
    (r) => canToggleOrdered(r) && r.item.status === "PENDING",
  );
  const orderedRecords = selectedRecords.filter(
    (r) => canToggleOrdered(r) && r.item.status === "ORDERED",
  );
  const outOfStockCandidates = selectedRecords.filter(
    (r) => canToggleOutOfStock(r) && r.item.status !== "OUT_OF_STOCK",
  );
  const cancelOutOfStockRecords = selectedRecords.filter(
    (r) => canToggleOutOfStock(r) && r.item.status === "OUT_OF_STOCK",
  );
  const isAllSelected =
    selectableRecords.length > 0 &&
    selectableRecords.every((r) => selectedIds.has(r.orderId));
  const isSomeSelected = selectableRecords.some((r) =>
    selectedIds.has(r.orderId),
  );

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
    flag: "ordered" | "outOfStock",
    checked: boolean,
    actionKey: string,
  ): Promise<void> => {
    if (targets.length === 0 || isBusy) return;
    setBusyAction(actionKey);
    try {
      await updateStatusFlag.mutateAsync({
        orderIds: targets.map((r) => r.orderId),
        flag,
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

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!records || records.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, pl: 2 }}>
        沒有作業明細
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {selectedRecords.length > 0 ? (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Typography variant="caption" sx={{ mr: 1 }}>
            已選 {selectedRecords.length} 筆：
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            disabled={pendingRecords.length === 0 || isBusy}
            startIcon={
              busyAction === "batch-confirm" ? (
                <CircularProgress size={14} />
              ) : undefined
            }
            onClick={() =>
              void runBatch(pendingRecords, "ordered", true, "batch-confirm")
            }
          >
            確認訂貨 {pendingRecords.length}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            disabled={orderedRecords.length === 0 || isBusy}
            startIcon={
              busyAction === "batch-cancel-order" ? (
                <CircularProgress size={14} />
              ) : undefined
            }
            onClick={() =>
              void runBatch(
                orderedRecords,
                "ordered",
                false,
                "batch-cancel-order",
              )
            }
          >
            取消訂貨 {orderedRecords.length}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={outOfStockCandidates.length === 0 || isBusy}
            startIcon={
              busyAction === "batch-oos" ? (
                <CircularProgress size={14} />
              ) : undefined
            }
            onClick={() =>
              void runBatch(
                outOfStockCandidates,
                "outOfStock",
                true,
                "batch-oos",
              )
            }
          >
            缺貨 {outOfStockCandidates.length}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={cancelOutOfStockRecords.length === 0 || isBusy}
            startIcon={
              busyAction === "batch-cancel-oos" ? (
                <CircularProgress size={14} />
              ) : undefined
            }
            onClick={() =>
              void runBatch(
                cancelOutOfStockRecords,
                "outOfStock",
                false,
                "batch-cancel-oos",
              )
            }
          >
            取消缺貨 {cancelOutOfStockRecords.length}
          </Button>
        </Stack>
      ) : null}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !isAllSelected && isSomeSelected;
                }}
                disabled={selectableRecords.length === 0 || isBusy}
                onChange={(e) => handleToggleAll(e.target.checked)}
                aria-label="全選"
              />
            </TableCell>
            <TableCell>訂單編號</TableCell>
            <TableCell>客戶</TableCell>
            <TableCell>規格</TableCell>
            <TableCell align="right">數量</TableCell>
            <TableCell>供應商</TableCell>
            <TableCell align="center">狀態</TableCell>
            <TableCell align="center">訂貨日</TableCell>
            <TableCell align="center">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((record) => (
            <DetailRow
              key={record.orderId}
              record={record}
              isBusy={isBusy}
              selected={selectedIds.has(record.orderId)}
              selectable={canBatchSelect(record)}
              onToggleSelect={(checked) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(record.orderId);
                  else next.delete(record.orderId);
                  return next;
                });
              }}
              onToggleOrdered={(r) => {
                setBusyAction(`row-ordered-${r.orderId}`);
                updateStatusFlag.mutate(
                  {
                    orderId: r.orderId,
                    orderItemId: r.item.id,
                    flag: "ordered",
                    checked: !r.item.purchasedAt,
                  },
                  { onSettled: () => setBusyAction(null) },
                );
              }}
              onToggleOutOfStock={(r) => {
                setBusyAction(`row-oos-${r.orderId}`);
                updateStatusFlag.mutate(
                  {
                    orderId: r.orderId,
                    orderItemId: r.item.id,
                    flag: "outOfStock",
                    checked: r.item.status !== "OUT_OF_STOCK",
                  },
                  { onSettled: () => setBusyAction(null) },
                );
              }}
              busyAction={busyAction}
            />
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}

function DetailRow({
  record,
  isBusy,
  selected,
  selectable,
  busyAction,
  onToggleSelect,
  onToggleOrdered,
  onToggleOutOfStock,
}: {
  record: ProductOrderItemRecord;
  isBusy: boolean;
  selected: boolean;
  selectable: boolean;
  busyAction: string | null;
  onToggleSelect: (checked: boolean) => void;
  onToggleOrdered: (r: ProductOrderItemRecord) => void;
  onToggleOutOfStock: (r: ProductOrderItemRecord) => void;
}): React.ReactElement {
  const { item } = record;
  const canOrdered =
    record.orderStatus !== "CANCELLED" &&
    (item.status === "PENDING" || item.status === "ORDERED");
  const canOutOfStock =
    record.orderStatus !== "CANCELLED" &&
    (item.status === "PENDING" ||
      item.status === "ORDERED" ||
      item.status === "OUT_OF_STOCK");
  const isOrderedLoading = busyAction === `row-ordered-${record.orderId}`;
  const isOosLoading = busyAction === `row-oos-${record.orderId}`;

  return (
    <TableRow hover selected={selected}>
      <TableCell padding="checkbox">
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable || isBusy}
          onChange={(e) => onToggleSelect(e.target.checked)}
          aria-label={`選取訂單 ${record.orderNumber}`}
        />
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{record.orderNumber}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{record.customerName}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {item.selectedOptionsSnapshot
          ?.map((opt) => opt.valueName)
          .join(" / ") || "-"}
      </TableCell>
      <TableCell align="right">{item.quantity}</TableCell>
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
      <TableCell align="center">{formatDate(item.purchasedAt)}</TableCell>
      <TableCell align="center">
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "center" }}>
          <Tooltip title={canOrdered ? "" : "不可操作"}>
            <span>
              <Button
                size="small"
                variant={item.purchasedAt ? "contained" : "outlined"}
                color="warning"
                disabled={!canOrdered || isBusy}
                startIcon={
                  isOrderedLoading ? <CircularProgress size={12} /> : undefined
                }
                sx={{ minWidth: 0, px: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleOrdered(record);
                }}
              >
                {item.purchasedAt ? "取消訂貨" : "確認訂貨"}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={canOutOfStock ? "" : "不可操作"}>
            <span>
              <Button
                size="small"
                variant={
                  item.status === "OUT_OF_STOCK" ? "contained" : "outlined"
                }
                color="error"
                disabled={!canOutOfStock || isBusy}
                startIcon={
                  isOosLoading ? <CircularProgress size={12} /> : undefined
                }
                sx={{ minWidth: 0, px: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleOutOfStock(record);
                }}
              >
                {item.status === "OUT_OF_STOCK" ? "取消缺貨" : "缺貨"}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Main Table
// ---------------------------------------------------------------------------

export interface ProductPurchasesTableProps {
  summaries: ProductPurchaseSummary[];
  isLoading: boolean;
  onSelectProduct: (summary: ProductPurchaseSummary) => void;
}

export function ProductPurchasesTable({
  summaries,
  isLoading,
  onSelectProduct,
}: ProductPurchasesTableProps): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>("pending");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const imageKeys = Array.from(
    new Set(
      summaries
        .map((summary) => summary.productImageUrl)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const { data: thumbnailUrls = [] } = useProductThumbnailUrls(imageKeys);
  const thumbnailUrlMap = new Map(
    imageKeys.map((key, index) => [key, thumbnailUrls[index] ?? undefined]),
  );

  const sortedSummaries = useMemo(
    () =>
      [...summaries].sort((a, b) =>
        compareSummaries(a, b, sortKey, sortDirection),
      ),
    [summaries, sortKey, sortDirection],
  );

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "sku" || key === "supplier" ? "asc" : "desc");
    }
  };

  const toggleExpand = (productId: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  return (
    <Box sx={{ mt: 2 }}>
      {isLoading ? (
        <Paper sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Paper>
      ) : summaries.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有符合條件的單品採購資料
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={listTableBodyTextSx}>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortKey === "sku"}
                    direction={sortKey === "sku" ? sortDirection : "asc"}
                    onClick={() => handleSort("sku")}
                  >
                    商品
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ width: 96 }}>
                  售價
                </TableCell>
                <TableCell align="right" sx={{ width: 96 }}>
                  成本
                </TableCell>
                <TableCell align="center" sx={{ width: 120 }}>
                  <TableSortLabel
                    active={sortKey === "supplier"}
                    direction={sortKey === "supplier" ? sortDirection : "asc"}
                    onClick={() => handleSort("supplier")}
                  >
                    供應商
                  </TableSortLabel>
                </TableCell>
                {PRODUCT_PURCHASE_STATUS_COLUMNS.map((status) => {
                  const isSortable =
                    status === "PENDING" || status === "ORDERED";
                  const key =
                    status === "PENDING"
                      ? "pending"
                      : status === "ORDERED"
                        ? "ordered"
                        : null;

                  return (
                    <TableCell key={status} align="right" sx={{ width: 80 }}>
                      {isSortable && key ? (
                        <TableSortLabel
                          active={sortKey === key}
                          direction={sortKey === key ? sortDirection : "desc"}
                          onClick={() => handleSort(key)}
                        >
                          {ORDER_ITEM_STATUS_LABEL[status] ?? status}
                        </TableSortLabel>
                      ) : (
                        (ORDER_ITEM_STATUS_LABEL[status] ?? status)
                      )}
                    </TableCell>
                  );
                })}
                <TableCell
                  align="center"
                  sx={{ width: 120, whiteSpace: "nowrap" }}
                >
                  <TableSortLabel
                    active={sortKey === "lastUpdated"}
                    direction={
                      sortKey === "lastUpdated" ? sortDirection : "desc"
                    }
                    onClick={() => handleSort("lastUpdated")}
                  >
                    最後更新
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ width: 60 }}>
                  操作
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedSummaries.map((summary) => {
                const thumbnailUrl = summary.productImageUrl
                  ? thumbnailUrlMap.get(summary.productImageUrl)
                  : undefined;
                const isExpanded = expandedIds.has(summary.productId);

                return (
                  <>
                    <TableRow
                      key={summary.productId}
                      hover
                      onClick={() => toggleExpand(summary.productId)}
                      sx={{
                        cursor: "pointer",
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{ alignItems: "center", minWidth: 0 }}
                        >
                          {thumbnailUrl ? (
                            <Box
                              component="img"
                              src={thumbnailUrl}
                              alt={summary.productName}
                              sx={{
                                width: 48,
                                height: 48,
                                objectFit: "cover",
                                borderRadius: 1,
                                border: "1px solid",
                                borderColor: "divider",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 1,
                                border: "1px dashed",
                                borderColor: "divider",
                                color: "text.disabled",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              —
                            </Box>
                          )}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {summary.productName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {summary.productSku || "—"}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(summary.price)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(summary.cost)}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          color: summary.supplierName
                            ? "text.primary"
                            : "text.secondary",
                        }}
                      >
                        {summary.supplierName || "—"}
                      </TableCell>
                      {PRODUCT_PURCHASE_STATUS_COLUMNS.map((status) => {
                        const value = summary.statusQuantities[status] ?? 0;

                        return (
                          <TableCell key={status} align="right">
                            {status === "PENDING" ? (
                              <Chip
                                label={value}
                                color={value > 0 ? "warning" : "default"}
                                size="small"
                                sx={{
                                  minWidth: 52,
                                  fontWeight: 700,
                                  justifyContent: "center",
                                }}
                              />
                            ) : (
                              value
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell align="center">
                        {summary.latestActivityAt
                          ? (() => {
                              const d = new Date(summary.latestActivityAt);
                              const date = d.toLocaleDateString("zh-TW", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              });
                              const time = d.toLocaleTimeString("zh-TW", {
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                              return (
                                <>
                                  {date}
                                  <br />
                                  {time}
                                </>
                              );
                            })()
                          : "—"}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProduct(summary);
                          }}
                          aria-label="編輯作業明細"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    <TableRow
                      key={`${summary.productId}-detail`}
                      sx={{
                        "& > td": {
                          py: 0,
                          borderBottom: isExpanded ? undefined : "none",
                        },
                      }}
                    >
                      <TableCell sx={{ px: 0 }} colSpan={COLUMN_COUNT}>
                        <Collapse in={isExpanded} timeout={250}>
                          <Box sx={{ px: 2, py: 1.5, bgcolor: "action.hover" }}>
                            <DetailPanel productId={summary.productId} />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
