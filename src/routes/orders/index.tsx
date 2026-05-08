import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import {
  useOrderList,
  type OrderStatusFilter,
} from "@/hooks/useOrders";
import { requireAuth } from "@/lib/route-guards";
import Box from "@mui/material/Box";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { OrderTable } from "./-components/OrderTable";
import { OrderToolbar } from "./-components/OrderToolbar";

export const Route = createFileRoute("/orders/")({
  beforeLoad: requireAuth,
  component: OrderListPage,
});

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

      <OrderTable orderIds={orderIds} isLoading={isLoading} onEdit={handleEdit} />

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
