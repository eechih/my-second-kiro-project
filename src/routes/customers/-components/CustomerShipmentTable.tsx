import { StatusChip } from "@/components/StatusChip";
import type { ShipmentStatusFilter } from "@/hooks/useCustomerShipments";
import {
  fetchAllCustomerOrders,
  useCreateShipmentWithOrders,
  useUpdateOrderItemStatusFlag,
  type CreateShipmentWithOrdersInput,
} from "@/hooks/useOrders";
import { client } from "@/lib/amplify-client";
import { formatCurrency } from "@/lib/currency";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PrintIcon from "@mui/icons-material/Print";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ORDER_FULFILLMENT_STATUS_LABEL, type Order } from "@shared/models";
import {
  SHIPMENT_STATUS_LABEL,
  type Shipment,
  type ShipmentStatus,
} from "@shared/models/shipment";
import { useEffect, useMemo, useState } from "react";
import { printPackingSlips } from "../../orders/-components/list/packingSlip";
import { ORDER_STATUS_COLOR_MAP } from "../../orders/-components/detail/detailUtils";

export type ShipmentFilter = ShipmentStatusFilter;

type SortKey =
  | "orderNumber"
  | "product"
  | "status"
  | "receivedAt"
  | "shippedAt";
type SortDirection = "asc" | "desc";

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function canToggleShipped(order: Order): boolean {
  return order.status === "RECEIVED" || order.status === "SHIPPED";
}

function canSelectForShipment(order: Order): boolean {
  return order.status === "RECEIVED";
}

function isShipmentRelevantOrder(order: Order): boolean {
  return order.status !== "CANCELLED";
}

function matchesShipmentFilter(order: Order, filter: ShipmentFilter): boolean {
  if (!isShipmentRelevantOrder(order)) return false;
  if (filter === "all") return true;
  if (filter === "readyToShip") return order.status === "RECEIVED";
  return true;
}

function compareOrders(
  a: Order,
  b: Order,
  sortKey: SortKey,
  direction: SortDirection,
): number {
  let result = 0;
  switch (sortKey) {
    case "orderNumber":
      result = a.orderNumber.localeCompare(b.orderNumber);
      break;
    case "product":
      result = a.productNameSnapshot.localeCompare(
        b.productNameSnapshot,
        "zh-Hant",
      );
      break;
    case "status":
      result = a.status.localeCompare(b.status);
      break;
    case "receivedAt":
      result = (a.receivedAt ?? "").localeCompare(b.receivedAt ?? "");
      break;
    case "shippedAt":
      result = (a.shippedAt ?? "").localeCompare(b.shippedAt ?? "");
      break;
  }
  return direction === "desc" ? -result : result;
}

function buildVariantLabel(order: Order): string {
  if (
    !order.selectedOptionsSnapshot ||
    order.selectedOptionsSnapshot.length === 0
  )
    return "-";
  return (
    order.selectedOptionsSnapshot.map((s) => s.valueName).join(" / ") || "-"
  );
}

// ---------------------------------------------------------------------------
// Create Shipment Dialog
// ---------------------------------------------------------------------------

interface CreateShipmentDialogProps {
  open: boolean;
  customerName: string;
  selectedOrders: Order[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: CreateShipmentWithOrdersInput) => void;
}

function CreateShipmentDialog({
  open,
  customerName,
  selectedOrders,
  isSubmitting,
  onClose,
  onSubmit,
}: CreateShipmentDialogProps): React.ReactElement {
  const [recipientName, setRecipientName] = useState(customerName);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [shippingMethod, setShippingMethod] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setRecipientName(customerName);
      setRecipientPhone("");
      setRecipientAddress(selectedOrders[0]?.shippingAddressSnapshot ?? "");
      setShippingMethod("");
      setNote("");
    }
  }, [open, customerName, selectedOrders]);

  const handleSubmit = (): void => {
    onSubmit({
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim() || undefined,
      recipientAddress: recipientAddress.trim() || undefined,
      shippingMethod: shippingMethod.trim() || undefined,
      note: note.trim() || undefined,
      orderIds: selectedOrders.map((o) => o.id),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>建立出貨單（{selectedOrders.length} 筆訂單）</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="收件人"
            size="small"
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
          <TextField
            label="收件電話"
            size="small"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
          />
          <TextField
            label="收件地址"
            size="small"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
          />
          <TextField
            label="寄送方式"
            size="small"
            value={shippingMethod}
            onChange={(e) => setShippingMethod(e.target.value)}
          />
          <TextField
            label="備註"
            size="small"
            multiline
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!recipientName.trim() || isSubmitting}
          startIcon={
            isSubmitting ? (
              <CircularProgress size={16} />
            ) : (
              <LocalShippingIcon />
            )
          }
        >
          建立出貨單
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Table
// ---------------------------------------------------------------------------

export interface CustomerShipmentTableProps {
  customerId: string;
  customerName: string;
  initialStatusFilter?: ShipmentFilter;
}

export function CustomerShipmentTable({
  customerId,
  customerName,
  initialStatusFilter = "all",
}: CustomerShipmentTableProps): React.ReactElement {
  const updateStatusFlag = useUpdateOrderItemStatusFlag();
  const createShipment = useCreateShipmentWithOrders();
  const isBusy = updateStatusFlag.isPending || createShipment.isPending;
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("orderNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [shipmentDialogOpen, setShipmentDialogOpen] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchAllCustomerOrders(customerId)
      .then((orders) => {
        if (!cancelled) {
          setAllOrders(orders);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("查詢客戶訂單失敗"));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const filteredOrders = useMemo(
    () =>
      allOrders.filter((o) => matchesShipmentFilter(o, initialStatusFilter)),
    [allOrders, initialStatusFilter],
  );

  const totalCount = filteredOrders.length;
  const pagedOrders = useMemo(() => {
    const sorted = [...filteredOrders].sort((a, b) =>
      compareOrders(a, b, sortKey, sortDirection),
    );
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [filteredOrders, page, rowsPerPage, sortKey, sortDirection]);

  const selectableOrders = useMemo(
    () => filteredOrders.filter(canSelectForShipment),
    [filteredOrders],
  );
  const selectedOrders = useMemo(
    () => filteredOrders.filter((o) => selectedIds.has(o.id)),
    [filteredOrders, selectedIds],
  );
  const shipmentCandidates = selectedOrders.filter(canSelectForShipment);
  const isAllSelected =
    selectableOrders.length > 0 &&
    selectableOrders.every((o) => selectedIds.has(o.id));
  const isSomeSelected = selectableOrders.some((o) => selectedIds.has(o.id));

  const summary = useMemo(
    () => ({
      received: filteredOrders.filter((o) => o.status === "RECEIVED").length,
      shipped: filteredOrders.filter((o) => o.status === "SHIPPED").length,
    }),
    [filteredOrders],
  );

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(
        key === "orderNumber" || key === "receivedAt" || key === "shippedAt"
          ? "desc"
          : "asc",
      );
    }
    setPage(0);
  };

  const handleToggleAll = (checked: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const o of selectableOrders) {
        if (checked) next.add(o.id);
        else next.delete(o.id);
      }
      return next;
    });
  };

  const handleCreateShipment = (input: CreateShipmentWithOrdersInput): void => {
    createShipment.mutate(input, {
      onSuccess: () => {
        setShipmentDialogOpen(false);
        setSelectedIds(new Set());
        // Refetch orders
        fetchAllCustomerOrders(customerId)
          .then(setAllOrders)
          .catch(() => {});
      },
    });
  };

  const handlePrint = async (): Promise<void> => {
    setPrintError(null);
    setIsPrinting(true);
    try {
      const printable = filteredOrders.filter(
        (o) => o.status === "RECEIVED" || o.status === "SHIPPED",
      );
      if (printable.length === 0) {
        setPrintError("目前沒有可列印的出貨品項");
        return;
      }
      const opened = printPackingSlips(printable, {
        orderFilter: () => true,
        emptyMessage: "沒有符合條件的出貨品項",
      });
      if (!opened) {
        setPrintError("無法開啟列印視窗，請允許瀏覽器彈出視窗後再試一次");
      }
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : "列印出貨單失敗");
    } finally {
      setIsPrinting(false);
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
            出貨管理
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            可出貨 {summary.received} 筆、已出貨 {summary.shipped} 筆
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          disabled={isLoading || isPrinting}
          onClick={() => void handlePrint()}
        >
          {isPrinting ? "列印中..." : "列印出貨單"}
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      ) : null}

      {printError ? (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setPrintError(null)}
        >
          {printError}
        </Alert>
      ) : null}

      {selectedOrders.length > 0 ? (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", flexWrap: "wrap", mb: 1.5 }}
        >
          <Typography variant="caption" sx={{ mr: 1 }}>
            已選 {selectedOrders.length} 筆：
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={
              busyAction === "create-shipment" ? (
                <CircularProgress size={14} />
              ) : (
                <LocalShippingIcon />
              )
            }
            disabled={shipmentCandidates.length === 0 || isBusy}
            onClick={() => setShipmentDialogOpen(true)}
          >
            建立出貨單 {shipmentCandidates.length}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="info"
            disabled={shipmentCandidates.length === 0 || isBusy}
            startIcon={
              busyAction === "batch-ship" ? (
                <CircularProgress size={14} />
              ) : undefined
            }
            onClick={async () => {
              if (shipmentCandidates.length === 0 || isBusy) return;
              setBusyAction("batch-ship");
              try {
                await updateStatusFlag.mutateAsync({
                  orderIds: shipmentCandidates.map((o) => o.id),
                  flag: "shipped" as "ordered",
                  checked: true,
                });
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  for (const o of shipmentCandidates) next.delete(o.id);
                  return next;
                });
                fetchAllCustomerOrders(customerId)
                  .then(setAllOrders)
                  .catch(() => {});
              } finally {
                setBusyAction(null);
              }
            }}
          >
            直接出貨 {shipmentCandidates.length}
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
      ) : filteredOrders.length === 0 ? (
        <Paper variant="outlined" sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有屬於「{customerName}」的符合條件訂單
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
                      disabled={selectableOrders.length === 0 || isBusy}
                      onChange={(e) => handleToggleAll(e.target.checked)}
                      aria-label="全選"
                    />
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === "orderNumber"}
                      direction={
                        sortKey === "orderNumber" ? sortDirection : "desc"
                      }
                      onClick={() => handleSort("orderNumber")}
                    >
                      訂單編號
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === "product"}
                      direction={sortKey === "product" ? sortDirection : "asc"}
                      onClick={() => handleSort("product")}
                    >
                      商品
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>規格</TableCell>
                  <TableCell align="right">數量</TableCell>
                  <TableCell align="right">單價</TableCell>
                  <TableCell align="center">
                    <TableSortLabel
                      active={sortKey === "status"}
                      direction={sortKey === "status" ? sortDirection : "asc"}
                      onClick={() => handleSort("status")}
                    >
                      狀態
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center">
                    <TableSortLabel
                      active={sortKey === "receivedAt"}
                      direction={
                        sortKey === "receivedAt" ? sortDirection : "desc"
                      }
                      onClick={() => handleSort("receivedAt")}
                    >
                      到貨日
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center">
                    <TableSortLabel
                      active={sortKey === "shippedAt"}
                      direction={
                        sortKey === "shippedAt" ? sortDirection : "desc"
                      }
                      onClick={() => handleSort("shippedAt")}
                    >
                      出貨日
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedOrders.map((order) => {
                  const canToggle = canToggleShipped(order);
                  const canSelect = canSelectForShipment(order);
                  const isRowLoading = busyAction === `row-${order.id}`;

                  return (
                    <TableRow
                      key={order.id}
                      hover
                      selected={selectedIds.has(order.id)}
                    >
                      <TableCell padding="checkbox">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          disabled={!canSelect || isBusy}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(order.id);
                              else next.delete(order.id);
                              return next;
                            });
                          }}
                          aria-label={`選取訂單 ${order.orderNumber}`}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {order.orderNumber}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {order.productNameSnapshot}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {buildVariantLabel(order)}
                      </TableCell>
                      <TableCell align="right">{order.quantity}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(order.unitPriceSnapshot)}
                      </TableCell>
                      <TableCell align="center">
                        <StatusChip
                          status={order.status}
                          label={ORDER_FULFILLMENT_STATUS_LABEL[order.status]}
                          colorMap={ORDER_STATUS_COLOR_MAP}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {formatDate(order.receivedAt)}
                      </TableCell>
                      <TableCell align="center">
                        {formatDate(order.shippedAt)}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant={order.shippedAt ? "contained" : "outlined"}
                          color="info"
                          disabled={!canToggle || isBusy}
                          startIcon={
                            isRowLoading ? (
                              <CircularProgress size={12} />
                            ) : undefined
                          }
                          sx={{ minWidth: 0, px: 1 }}
                          onClick={() => {
                            setBusyAction(`row-${order.id}`);
                            updateStatusFlag.mutate(
                              {
                                orderId: order.id,
                                flag: "shipped",
                                checked: !order.shippedAt,
                              },
                              {
                                onSettled: () => {
                                  setBusyAction(null);
                                  fetchAllCustomerOrders(customerId)
                                    .then(setAllOrders)
                                    .catch(() => {});
                                },
                              },
                            );
                          }}
                        >
                          {order.shippedAt ? "取消出貨" : "確認出貨"}
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

      <CreateShipmentDialog
        open={shipmentDialogOpen}
        customerName={customerName}
        selectedOrders={shipmentCandidates}
        isSubmitting={createShipment.isPending}
        onClose={() => setShipmentDialogOpen(false)}
        onSubmit={handleCreateShipment}
      />

      <ShipmentHistory orders={allOrders} />
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Shipment History
// ---------------------------------------------------------------------------

const SHIPMENT_SELECTION_SET = [
  "id",
  "shipmentNumber",
  "recipientName",
  "recipientPhone",
  "recipientAddress",
  "status",
  "shippingMethod",
  "trackingNumber",
  "actualShippingCost",
  "shippedAt",
  "deliveredAt",
  "cancelledAt",
  "note",
  "createdAt",
  "updatedAt",
] as const;

const SHIPMENT_STATUS_COLOR_MAP: Record<
  ShipmentStatus,
  "default" | "info" | "success" | "warning" | "error"
> = {
  PENDING: "warning",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "error",
};

function mapToShipment(raw: Record<string, unknown>): Shipment {
  return {
    id: String(raw.id ?? ""),
    shipmentNumber: String(raw.shipmentNumber ?? ""),
    recipientName: String(raw.recipientName ?? ""),
    recipientPhone: raw.recipientPhone ? String(raw.recipientPhone) : null,
    recipientAddress: raw.recipientAddress
      ? String(raw.recipientAddress)
      : null,
    status: (raw.status as ShipmentStatus) ?? "PENDING",
    shippingMethod: raw.shippingMethod ? String(raw.shippingMethod) : null,
    trackingNumber: raw.trackingNumber ? String(raw.trackingNumber) : null,
    actualShippingCost: Number(raw.actualShippingCost ?? 0),
    shippedAt: raw.shippedAt ? String(raw.shippedAt) : null,
    deliveredAt: raw.deliveredAt ? String(raw.deliveredAt) : null,
    cancelledAt: raw.cancelledAt ? String(raw.cancelledAt) : null,
    note: raw.note ? String(raw.note) : null,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function ShipmentHistory({ orders }: { orders: Order[] }): React.ReactElement {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const shipmentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const o of orders) {
      if (o.shipmentId) ids.add(o.shipmentId);
    }
    return Array.from(ids);
  }, [orders]);

  useEffect(() => {
    if (shipmentIds.length === 0) {
      setShipments([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all(
      shipmentIds.map(async (id) => {
        const { data } = await client.models.Shipment.get(
          { id },
          { selectionSet: SHIPMENT_SELECTION_SET },
        );
        return data
          ? mapToShipment(data as unknown as Record<string, unknown>)
          : null;
      }),
    )
      .then((results) => {
        if (!cancelled) {
          setShipments(
            results
              .filter((s): s is Shipment => s !== null)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shipmentIds]);

  if (shipmentIds.length === 0) return <></>;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        出貨單紀錄
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>出貨單號</TableCell>
                <TableCell>收件人</TableCell>
                <TableCell>寄送方式</TableCell>
                <TableCell>追蹤碼</TableCell>
                <TableCell align="center">狀態</TableCell>
                <TableCell align="center">出貨日</TableCell>
                <TableCell align="center">送達日</TableCell>
                <TableCell align="center">建立日</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {s.shipmentNumber}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {s.recipientName}
                  </TableCell>
                  <TableCell>{s.shippingMethod || "-"}</TableCell>
                  <TableCell>{s.trackingNumber || "-"}</TableCell>
                  <TableCell align="center">
                    <StatusChip
                      status={s.status}
                      label={SHIPMENT_STATUS_LABEL[s.status]}
                      colorMap={SHIPMENT_STATUS_COLOR_MAP}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {formatDate(s.shippedAt)}
                  </TableCell>
                  <TableCell align="center">
                    {formatDate(s.deliveredAt)}
                  </TableCell>
                  <TableCell align="center">
                    {formatDate(s.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
