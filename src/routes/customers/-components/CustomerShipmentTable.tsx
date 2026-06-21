import { StatusChip } from "@/components/StatusChip";
import type { ShipmentStatusFilter } from "@/hooks/useCustomerShipments";
import {
  fetchAllCustomerOrders,
  useUpdateOrderItemStatusFlag,
} from "@/hooks/useOrders";
import { formatCurrency } from "@/lib/currency";
import PrintIcon from "@mui/icons-material/Print";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import {
  ORDER_FULFILLMENT_STATUS_LABEL,
  type Order,
} from "@shared/models";
import { useEffect, useMemo, useState } from "react";
import { printPackingSlips } from "../../orders/-components/list/packingSlip";
import {
  ORDER_STATUS_COLOR_MAP,
} from "../../orders/-components/detail/detailUtils";

export type ShipmentFilter = ShipmentStatusFilter;

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

function isShipmentRelevantOrder(order: Order): boolean {
  return order.status !== "CANCELLED";
}

function matchesShipmentFilter(
  order: Order,
  statusFilter: ShipmentFilter,
): boolean {
  if (!isShipmentRelevantOrder(order)) {
    return false;
  }

  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "readyToShip") {
    return order.status === "RECEIVED";
  }

  return true;
}

function buildVariantLabel(order: Order): string | null {
  if (!order.selectedOptionsSnapshot || order.selectedOptionsSnapshot.length === 0) {
    return null;
  }
  const names = order.selectedOptionsSnapshot
    .map((s) => s.valueName.trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(" / ") : null;
}

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
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
    () => allOrders.filter((order) => matchesShipmentFilter(order, initialStatusFilter)),
    [allOrders, initialStatusFilter],
  );

  const sortedOrders = useMemo(
    () =>
      [...filteredOrders].sort((a, b) => {
        const timeA = Date.parse(
          a.shippedAt ?? a.receivedAt ?? a.purchasedAt ?? a.createdAt ?? "1970-01-01T00:00:00.000Z",
        );
        const timeB = Date.parse(
          b.shippedAt ?? b.receivedAt ?? b.purchasedAt ?? b.createdAt ?? "1970-01-01T00:00:00.000Z",
        );
        return timeB - timeA;
      }),
    [filteredOrders],
  );

  const currentSummary = useMemo(
    () => ({
      orders: filteredOrders.length,
      items: filteredOrders.reduce((sum, order) => sum + order.quantity, 0),
    }),
    [filteredOrders],
  );

  const canPrint = !isLoading && !isPrinting;

  async function handlePrint(): Promise<void> {
    if (!canPrint) {
      return;
    }

    setPrintError(null);
    setIsPrinting(true);

    try {
      const printableOrders = filteredOrders.filter(
        (order) => order.status === "RECEIVED" || order.status === "SHIPPED",
      );

      if (printableOrders.length === 0) {
        setPrintError("目前沒有可列印的出貨品項");
        return;
      }

      const opened = printPackingSlips(printableOrders, {
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
  }

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            出貨管理
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            依客戶查看「{customerName}」的可出貨與已出貨訂單。
          </Typography>
        </Box>
        <Box sx={{ ml: "auto" }}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            disabled={!canPrint}
            onClick={() => {
              void handlePrint();
            }}
          >
            {isPrinting ? "列印中..." : "列印出貨單"}
          </Button>
        </Box>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
        <Alert severity="info" sx={{ py: 0 }}>
          訂單 {currentSummary.orders} 筆
        </Alert>
        <Alert severity="success" sx={{ py: 0 }}>
          品項 {currentSummary.items} 項
        </Alert>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      ) : null}

      {printError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPrintError(null)}>
          {printError}
        </Alert>
      ) : null}

      {isLoading ? (
        <Paper
          variant="outlined"
          sx={{ display: "flex", justifyContent: "center", py: 6 }}
        >
          <CircularProgress />
        </Paper>
      ) : sortedOrders.length === 0 ? (
        <Paper variant="outlined" sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有屬於「{customerName}」的符合條件訂單
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table sx={{ minWidth: 1120 }}>
            <TableHead>
              <TableRow>
                <TableCell>訂單編號</TableCell>
                <TableCell>商品</TableCell>
                <TableCell>規格</TableCell>
                <TableCell align="right">數量</TableCell>
                <TableCell align="right">單價</TableCell>
                <TableCell align="center">訂單狀態</TableCell>
                <TableCell align="center">到貨日期</TableCell>
                <TableCell align="center">出貨日期</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedOrders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{order.productNameSnapshot}</TableCell>
                  <TableCell>{buildVariantLabel(order) || "-"}</TableCell>
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
                      color="success"
                      disabled={
                        !canToggleShipped(order) ||
                        updateStatusFlag.isPending
                      }
                      onClick={() =>
                        updateStatusFlag.mutate({
                          orderId: order.id,
                          flag: "shipped",
                          checked: !order.shippedAt,
                        })
                      }
                    >
                      {order.shippedAt ? "取消出貨" : "確認出貨"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
