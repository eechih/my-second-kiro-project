import { CursorPaginationBar } from "@/components/CursorPaginationBar";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import {
  useCustomerOrderList,
  useOrderList,
  type OrderStatusFilter,
} from "@/hooks/useOrders";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { OrderTable } from "./-components/list/OrderTable";
import { Toolbar } from "./-components/list/Toolbar";

export const Route = createFileRoute("/orders/")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>) => ({
    customerId:
      typeof search["customerId"] === "string"
        ? search["customerId"]
        : undefined,
    customerName:
      typeof search["customerName"] === "string"
        ? search["customerName"]
        : undefined,
  }),
  component: OrderListPage,
});

function OrderListPage(): React.ReactElement {
  const navigate = useNavigate();
  const { customerId, customerName } = Route.useSearch();
  const pagination = useCursorPagination(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const isScopedMode = Boolean(customerId);

  const orderListQuery = useOrderList({
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
    search: search || undefined,
    customerId,
    enabled: !isScopedMode,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const customerOrderListQuery = useCustomerOrderList({
    customerId: customerId ?? "",
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
  });
  const activeOrderList = customerId ? customerOrderListQuery : orderListQuery;
  const orders = activeOrderList.data?.items ?? [];
  const nextToken = activeOrderList.data?.nextToken;
  const isLoading = activeOrderList.isLoading;

  const handleEdit = useCallback(
    (orderId: string): void => {
      void navigate({
        to: "/orders/$orderId" as string,
        params: { orderId } as Record<string, string>,
      });
    },
    [navigate],
  );

  const pageNumber = pagination.tokenStack.length + 1;
  const fetchedSoFar =
    pagination.tokenStack.length * pagination.pageSize + orders.length;

  return (
    <Box>
      <PageHeader section="訂單" current="列表" title="列表" />

      {isScopedMode && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() =>
                void navigate({
                  to: "/orders",
                  search: { customerId: undefined, customerName: undefined },
                })
              }
            >
              查看全部訂單
            </Button>
          }
        >
          目前只顯示
          {customerName ? `「${customerName}」` : "指定客戶"}
          的全部訂單
        </Alert>
      )}

      <Toolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          pagination.reset();
        }}
        totalCount={orders.length}
        hideSearch={isScopedMode}
        hideStatusFilter={isScopedMode}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          pagination.reset();
        }}
        onAddClick={() => navigate({ to: "/orders/new" })}
      />

      <OrderTable orders={orders} isLoading={isLoading} onEdit={handleEdit} />

      <CursorPaginationBar
        pageNumber={pageNumber}
        hasNextPage={!!nextToken}
        hasPrevPage={pagination.tokenStack.length > 0}
        onNextPage={() => {
          if (nextToken) pagination.goNext(nextToken);
        }}
        onPrevPage={pagination.goPrev}
        pageSize={pagination.pageSize}
        pageSizeOptions={[10, 25, 50, 100]}
        onPageSizeChange={pagination.setPageSize}
        currentCount={fetchedSoFar}
      />
    </Box>
  );
}
