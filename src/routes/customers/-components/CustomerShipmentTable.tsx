import { CursorPagination } from "@/components/CursorPagination";
import { StatusChip } from "@/components/StatusChip";
import type { ShipmentStatusFilter } from "@/hooks/useCustomerShipments";
import {
  fetchAllCustomerOrders,
  useCustomerOrderList,
  useUpdateOrderItemStatusFlag,
} from "@/hooks/useOrders";
import { useCursorPagination } from "@/hooks/useCursorPagination";
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
  ORDER_ITEM_STATUS_LABEL,
  FULFILLMENT_STATUS_LABEL,
  type Order,
  type OrderItem,
} from "@shared/models";
import { useEffect, useMemo, useState } from "react";
import { printPackingSlips } from "../../orders/-components/list/packingSlip";
import {
  ORDER_ITEM_STATUS_COLOR_MAP,
  ORDER_STATUS_COLOR_MAP,
  ORDER_STATUS_LABEL,
} from "../../orders/-components/detail/detailUtils";

export type ShipmentFilter = ShipmentStatusFilter;

type CustomerShipmentRecord = {
  orderId: string;
  orderNumber: string;
  orderStatus: Order["status"];
  fulfillmentStatus: Order["fulfillmentStatus"];
  orderCreatedAt: string;
  item: OrderItem;
};

const PAGE_SIZE = 10;

const FULFILLMENT_STATUS_COLOR_MAP = {
  UNFULFILLED: "warning",
  READY_TO_SHIP: "primary",
  SHIPPED: "info",
  COMPLETED: "success",
} as const;

function formatDate(value: string | null): string {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function canToggleShipped(item: OrderItem): boolean {
  return item.status === "received" || item.status === "shipped";
}

function isPrintableShipmentItem(
  item: OrderItem,
  statusFilter: ShipmentFilter,
): boolean {
  if (statusFilter === "pending") {
    return false;
  }

  if (statusFilter === "readyToShip") {
    return item.status === "received" && !item.shippedAt;
  }

  if (statusFilter === "shipped") {
    return item.status === "shipped" || Boolean(item.shippedAt);
  }

  return (
    item.status === "received" ||
    item.status === "shipped" ||
    Boolean(item.shippedAt)
  );
}

function isShipmentRelevantOrder(order: Order): boolean {
  return order.status !== "CANCELLED" && order.status !== "REFUNDED";
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

  if (statusFilter === "pending") {
    return order.fulfillmentStatus === "UNFULFILLED";
  }

  if (statusFilter === "readyToShip") {
    return order.fulfillmentStatus === "READY_TO_SHIP";
  }

  return (
    order.fulfillmentStatus === "SHIPPED" ||
    order.fulfillmentStatus === "COMPLETED"
  );
}

function extractShipmentRecords(
  orders: readonly Order[],
  statusFilter: ShipmentFilter,
): CustomerShipmentRecord[] {
  return orders
    .filter((order) => matchesShipmentFilter(order, statusFilter))
    .flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        orderCreatedAt: order.createdAt,
        item,
      })),
    )
    .sort((a, b) => {
      const timeA = Date.parse(
        a.item.shippedAt ??
          a.item.receivedAt ??
          a.item.purchasedAt ??
          a.orderCreatedAt ??
          "1970-01-01T00:00:00.000Z",
      );
      const timeB = Date.parse(
        b.item.shippedAt ??
          b.item.receivedAt ??
          b.item.purchasedAt ??
          b.orderCreatedAt ??
          "1970-01-01T00:00:00.000Z",
      );
      return timeB - timeA;
    });
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
  const {
    currentToken,
    pageSize,
    tokenStack,
    goNext,
    goPrev,
    setPageSize,
    reset,
  } = useCursorPagination(PAGE_SIZE);
  const updateStatusFlag = useUpdateOrderItemStatusFlag();
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const { data, isLoading, error } = useCustomerOrderList({
    customerId,
    pageSize,
    nextToken: currentToken,
  });

  useEffect(() => {
    reset();
  }, [reset, customerId]);

  const orders = useMemo(() => data?.items ?? [], [data?.items]);
  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesShipmentFilter(order, initialStatusFilter)),
    [orders, initialStatusFilter],
  );
  const records = useMemo(
    () => extractShipmentRecords(orders, initialStatusFilter),
    [orders, initialStatusFilter],
  );
  const currentSummary = useMemo(
    () =>
      filteredOrders.reduce(
        (acc, order) => {
          acc.orders += 1;
          acc.items += order.items.reduce(
            (sum, item) => sum + Number(item.quantity ?? 0),
            0,
          );
          return acc;
        },
        { orders: 0, items: 0 },
      ),
    [filteredOrders],
  );
  const canPrint =
    initialStatusFilter !== "pending" && !isLoading && !isPrinting;

  async function handlePrint(): Promise<void> {
    if (!canPrint) {
      return;
    }

    setPrintError(null);
    setIsPrinting(true);

    try {
      const allOrders = await fetchAllCustomerOrders(customerId);
      const printableOrders = allOrders
        .filter((order) => matchesShipmentFilter(order, initialStatusFilter))
        .map((order) => ({
          ...order,
          items: order.items.filter((item) =>
            isPrintableShipmentItem(item, initialStatusFilter),
          ),
        }))
        .filter((order) => order.items.length > 0);

      if (printableOrders.length === 0) {
        setPrintError("目前沒有可列印的出貨品項");
        return;
      }

      const opened = printPackingSlips(printableOrders, {
        itemFilter: () => true,
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
            依客戶查看「{customerName}」的待處理、可出貨與已出貨訂單明細。
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
          {error instanceof Error ? error.message : "查詢客戶出貨資料失敗"}
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
      ) : records.length === 0 ? (
        <Paper variant="outlined" sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有屬於「{customerName}」的符合條件訂單明細
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table sx={{ minWidth: 1120 }}>
              <TableHead>
                <TableRow>
                  <TableCell>訂單編號</TableCell>
                  <TableCell>商品</TableCell>
                  <TableCell>規格</TableCell>
                  <TableCell align="right">數量</TableCell>
                  <TableCell align="right">單價</TableCell>
                  <TableCell align="center">明細狀態</TableCell>
                  <TableCell align="center">履約狀態</TableCell>
                  <TableCell align="center">訂單狀態</TableCell>
                  <TableCell align="center">到貨日期</TableCell>
                  <TableCell align="center">出貨日期</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.item.id} hover>
                    <TableCell>{record.orderNumber}</TableCell>
                    <TableCell>{record.item.productName}</TableCell>
                    <TableCell>{record.item.variantLabel || "-"}</TableCell>
                    <TableCell align="right">{record.item.quantity}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(record.item.unitPrice)}
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
                        status={record.fulfillmentStatus}
                        label={
                          FULFILLMENT_STATUS_LABEL[record.fulfillmentStatus]
                        }
                        colorMap={FULFILLMENT_STATUS_COLOR_MAP}
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
                      {formatDate(record.item.receivedAt)}
                    </TableCell>
                    <TableCell align="center">
                      {formatDate(record.item.shippedAt)}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant={
                          record.item.shippedAt ? "contained" : "outlined"
                        }
                        color="success"
                        disabled={
                          !canToggleShipped(record.item) ||
                          updateStatusFlag.isPending
                        }
                        onClick={() =>
                          updateStatusFlag.mutate({
                            orderId: record.orderId,
                            orderItemId: record.item.id,
                            flag: "shipped",
                            checked: !record.item.shippedAt,
                          })
                        }
                      >
                        {record.item.shippedAt ? "取消出貨" : "確認出貨"}
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
            currentCount={orders.length}
          />
        </>
      )}
    </Paper>
  );
}
