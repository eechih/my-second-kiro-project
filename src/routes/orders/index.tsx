import { CursorPagination } from "@/components/CursorPagination";
import { listTableBodyTextSx } from "@/components/listTableStyles";
import { PageHeader } from "@/components/PageHeader";
import { StatusChip } from "@/components/StatusChip";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import {
  useOrder,
  useOrderList,
  type OrderStatusFilter,
} from "@/hooks/useOrders";
import { requireAuth } from "@/lib/route-guards";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
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
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { OrderToolbar } from "./-components/OrderToolbar";

export const Route = createFileRoute("/orders/")({
  beforeLoad: requireAuth,
  component: OrderListPage,
});

/** 訂單狀態顏色對應 */
const ORDER_STATUS_COLOR_MAP: Record<
  string,
  "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  pending: "warning",
  confirmed: "info",
  shipping: "primary",
  completed: "success",
  cancelled: "error",
};

/** 訂單狀態中文標籤 */
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  confirmed: "已確認",
  shipping: "出貨中",
  completed: "已完成",
  cancelled: "已取消",
};

function OrderListPage(): React.ReactElement {
  const navigate = useNavigate();
  const pagination = useCursorPagination(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");

  const { data, isLoading } = useOrderList({
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const orderIds = useMemo(() => data?.items ?? [], [data?.items]);
  const nextToken = data?.nextToken;

  const handleEdit = useCallback(
    (orderId: string): void => {
      void navigate({
        to: "/orders/$orderId" as string,
        params: { orderId } as Record<string, string>,
      });
    },
    [navigate],
  );

  return (
    <Box>
      <PageHeader section="訂單" current="列表" title="列表" />

      <OrderToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          pagination.reset();
        }}
        totalCount={data?.totalCount ?? 0}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          pagination.reset();
        }}
        onMergeClick={() => navigate({ to: "/orders/merge" as string })}
        onAddClick={() => navigate({ to: "/orders/new" })}
      />

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table sx={listTableBodyTextSx}>
            <TableHead>
              <TableRow>
                <TableCell>訂單編號</TableCell>
                <TableCell>客戶名稱</TableCell>
                <TableCell align="right">總金額</TableCell>
                <TableCell align="center">狀態</TableCell>
                <TableCell>建立日期</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orderIds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      目前沒有符合條件的訂單資料
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                orderIds.map((orderId) => (
                  <OrderTableRow
                    key={orderId}
                    orderId={orderId}
                    onEdit={handleEdit}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <CursorPagination
        pageSize={pagination.pageSize}
        onPageSizeChange={pagination.setPageSize}
        hasNextPage={!!nextToken}
        hasPrevPage={pagination.tokenStack.length > 0}
        onNextPage={() => {
          if (nextToken) pagination.goNext(nextToken);
        }}
        onPrevPage={pagination.goPrev}
        currentCount={orderIds.length}
      />
    </Box>
  );
}

interface OrderTableRowProps {
  orderId: string;
  onEdit: (orderId: string) => void;
}

function OrderTableRow({
  orderId,
  onEdit,
}: OrderTableRowProps): React.ReactElement {
  const { data: order, isLoading, error } = useOrder(orderId);

  if (isLoading) {
    return (
      <TableRow hover>
        <TableCell colSpan={6}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography color="text.secondary">載入訂單資料中...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  if (error || !order) {
    return (
      <TableRow hover>
        <TableCell colSpan={6}>
          <Typography color="error">
            {error instanceof Error ? error.message : "查詢訂單失敗"}
          </Typography>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow hover>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell>{order.customerName}</TableCell>
      <TableCell align="right">
        ${order.totalAmount.toLocaleString()}
      </TableCell>
      <TableCell align="center">
        <StatusChip
          status={ORDER_STATUS_LABEL[order.status] ?? order.status}
          colorMap={{
            待處理: "warning",
            已確認: "info",
            出貨中: "primary",
            已完成: "success",
            已取消: "error",
            ...ORDER_STATUS_COLOR_MAP,
          }}
        />
      </TableCell>
      <TableCell>{formatDate(order.createdAt)}</TableCell>
      <TableCell>
        <Tooltip title="編輯">
          <IconButton
            size="small"
            onClick={() => {
              onEdit(order.id);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("zh-TW");
  } catch {
    return dateStr;
  }
}
