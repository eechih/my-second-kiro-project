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
import {
  ORDER_ITEM_STATUS_LABEL,
  type Order,
  type OrderItem,
} from "@shared/models";
import { useEffect, useMemo, useState } from "react";
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
  item: OrderItem;
};

const PAGE_SIZE = 10;

const SHIPMENT_FILTER_OPTIONS = [
  { value: "all", label: "待出貨與已出貨" },
  { value: "received", label: "待出貨" },
  { value: "shipped", label: "已出貨" },
] as const satisfies readonly { value: ShipmentFilter; label: string }[];

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

function extractShipmentRecords(
  orders: readonly Order[],
  statusFilter: ShipmentFilter,
): CustomerShipmentRecord[] {
  return orders
    .flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        item,
      })),
    )
    .filter((record) => {
      if (statusFilter === "received") return record.item.status === "received";
      if (statusFilter === "shipped") return record.item.status === "shipped";
      return (
        record.item.status === "received" || record.item.status === "shipped"
      );
    })
    .sort((a, b) => {
      const timeA = Date.parse(
        a.item.shippedAt ?? a.item.receivedAt ?? "1970-01-01T00:00:00.000Z",
      );
      const timeB = Date.parse(
        b.item.shippedAt ?? b.item.receivedAt ?? "1970-01-01T00:00:00.000Z",
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
  const [statusFilter, setStatusFilter] =
    useState<ShipmentFilter>(initialStatusFilter);
  const updateStatusFlag = useUpdateOrderItemStatusFlag();
  const { data, isLoading, error } = useCustomerOrderList({
    customerId,
    pageSize,
    nextToken: currentToken,
  });

  useEffect(() => {
    reset();
  }, [reset, customerId]);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [customerId, initialStatusFilter]);

  const orders = useMemo(() => data?.items ?? [], [data?.items]);
  const records = useMemo(
    () => extractShipmentRecords(orders, statusFilter),
    [orders, statusFilter],
  );
  const summary = useMemo(
    () =>
      records.reduce(
        (acc, record) => {
          if (record.item.status === "received") acc.received += 1;
          if (record.item.status === "shipped") acc.shipped += 1;
          return acc;
        },
        { received: 0, shipped: 0 },
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
            出貨管理
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            依客戶查看「{customerName}」的待出貨與已出貨明細，直接完成出貨操作。
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          label="狀態"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as ShipmentFilter)
          }
          sx={{ minWidth: 180 }}
        >
          {SHIPMENT_FILTER_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
        <Alert severity="info" sx={{ py: 0 }}>
          待出貨 {summary.received} 筆
        </Alert>
        <Alert severity="success" sx={{ py: 0 }}>
          已出貨 {summary.shipped} 筆
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
            目前沒有屬於「{customerName}」的出貨明細
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
