import { CursorPagination } from "@/components/CursorPagination";
import { StatusChip } from "@/components/StatusChip";
import type { ShipmentStatusFilter } from "@/hooks/useCustomerShipments";
import {
  useCustomerOrderList,
  useUpdateOrderItemStatusFlag,
} from "@/hooks/useOrders";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { formatCurrency } from "@/lib/currency";
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
import { useEffect, useMemo } from "react";
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
