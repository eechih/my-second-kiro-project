import { CursorPagination } from "@/components/CursorPagination";
import { listTableBodyTextSx } from "@/components/listTableStyles";
import { PageHeader } from "@/components/PageHeader";
import { StatusChip } from "@/components/StatusChip";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import type { OrderStatusFilter } from "@/hooks/useOrders";
import { useOrderList } from "@/hooks/useOrders";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { Order } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { OrderToolbar } from "./-components/OrderToolbar";

export const Route = createFileRoute("/orders/")({
  beforeLoad: requireAuth,
  component: OrderListPage,
});

const columnHelper = createColumnHelper<Order>();

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
  const orders = useMemo(() => data?.items ?? [], [data?.items]);
  const nextToken = data?.nextToken;

  const columns = useMemo(
    () => [
      columnHelper.accessor("orderNumber", {
        header: "訂單編號",
      }),
      columnHelper.accessor("customerName", {
        header: "客戶名稱",
      }),
      columnHelper.accessor("totalAmount", {
        header: "總金額",
        cell: ({ getValue }) => `$${getValue<number>().toLocaleString()}`,
      }),
      columnHelper.accessor("status", {
        header: "狀態",
        cell: ({ getValue }) => {
          const status = getValue<string>();
          return (
            <StatusChip
              status={ORDER_STATUS_LABEL[status] ?? status}
              colorMap={{
                待處理: "warning",
                已確認: "info",
                出貨中: "primary",
                已完成: "success",
                已取消: "error",
                ...ORDER_STATUS_COLOR_MAP,
              }}
            />
          );
        },
      }),
      columnHelper.accessor("createdAt", {
        header: "建立日期",
        cell: ({ getValue }) => {
          const dateStr = getValue<string>();
          if (!dateStr) return "";
          try {
            return new Date(dateStr).toLocaleDateString("zh-TW");
          } catch {
            return dateStr;
          }
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableCell key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    align="center"
                    sx={{ py: 4 }}
                  >
                    <Typography color="text.secondary">
                      目前沒有符合條件的訂單資料
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
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
        currentCount={orders.length}
      />
    </Box>
  );
}
