import { useState, useCallback } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { type ColumnDef } from "@tanstack/react-table";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import MergeIcon from "@mui/icons-material/CallMerge";
import { DataTable } from "@/components/DataTable";
import { SearchBar } from "@/components/SearchBar";
import { StatusChip } from "@/components/StatusChip";
import { useOrderList, usePrefetchOrder } from "@/hooks/useOrders";
import type { Order } from "@shared/models";

export const Route = createFileRoute("/orders/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
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

function OrderListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useOrderList({ page, search });
  const prefetchOrder = usePrefetchOrder();

  const handleRowHover = useCallback(
    (order: Order) => {
      prefetchOrder(order.id);
    },
    [prefetchOrder],
  );

  const columns: ColumnDef<Order, unknown>[] = [
    {
      accessorKey: "orderNumber",
      header: "訂單編號",
    },
    {
      accessorKey: "customerName",
      header: "客戶名稱",
    },
    {
      accessorKey: "totalAmount",
      header: "總金額",
      cell: ({ getValue }) => `$${getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: "status",
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
    },
    {
      accessorKey: "createdAt",
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
    },
  ];

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4">訂單管理</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<MergeIcon />}
            onClick={() => navigate({ to: "/orders/merge" as string })}
          >
            合併訂單
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate({ to: "/orders/new" })}
          >
            新增訂單
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <SearchBar
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(0);
          }}
          placeholder="搜尋訂單編號或客戶名稱..."
        />
      </Box>

      <DataTable<Order>
        columns={columns}
        data={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(0);
        }}
        isLoading={isLoading}
        onRowClick={(order) =>
          navigate({
            to: "/orders/$orderId" as string,
            params: { orderId: order.id } as Record<string, string>,
          })
        }
        onRowMouseEnter={handleRowHover}
      />
    </Box>
  );
}
