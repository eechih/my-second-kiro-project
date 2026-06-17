import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import {
  useCustomerShipmentSummaries,
  type ShipmentStatusFilter,
} from "@/hooks/useCustomerShipments";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CustomerShipmentSummaryTable } from "./-components/CustomerShipmentSummaryTable";

const STATUS_FILTER_OPTIONS = [
  { value: "readyToShip", label: "可出貨" },
  { value: "shipped", label: "已出貨" },
  { value: "all", label: "全部" },
] as const satisfies readonly { value: ShipmentStatusFilter; label: string }[];

function normalizeShipmentStatusFilter(
  value: unknown,
  fallback: ShipmentStatusFilter = "readyToShip",
): ShipmentStatusFilter {
  return value === "readyToShip" ||
    value === "shipped" ||
    value === "all"
    ? value
    : fallback;
}

export const Route = createFileRoute("/customer-shipments/")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>) => ({
    status: normalizeShipmentStatusFilter(search["status"]),
  }),
  component: CustomerShipmentListPage,
});

function CustomerShipmentListPage(): React.ReactElement {
  const navigate = useNavigate();
  const { status } = Route.useSearch();
  const [search, setSearch] = useState("");
  const statusFilter = status;
  const { data, isLoading, error } = useCustomerShipmentSummaries(statusFilter);
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const filteredSummaries = useMemo(() => {
    const keyword = search.trim();

    return (data ?? [])
      .map((summary) => {
        if (statusFilter === "readyToShip") {
          return {
            customerId: summary.customerId,
            customerName: summary.customerName,
            latestReadyToShipReceivedAt: summary.latestReadyToShipReceivedAt,
            latestShippedAt: summary.latestShippedAt,
            totalOrderCount: summary.totalOrderCount,
            completedOrderCount: summary.completedOrderCount,
            orderCount: summary.readyToShipOrderCount,
            itemCount: summary.readyToShipItemCount,
          };
        }

        if (statusFilter === "shipped") {
          return {
            customerId: summary.customerId,
            customerName: summary.customerName,
            latestReadyToShipReceivedAt: summary.latestReadyToShipReceivedAt,
            latestShippedAt: summary.latestShippedAt,
            totalOrderCount: summary.totalOrderCount,
            completedOrderCount: summary.completedOrderCount,
            orderCount: summary.shippedOrderCount,
            itemCount: summary.shippedItemCount,
          };
        }

        return {
          customerId: summary.customerId,
          customerName: summary.customerName,
          latestReadyToShipReceivedAt: summary.latestReadyToShipReceivedAt,
          latestShippedAt: summary.latestShippedAt,
          totalOrderCount: summary.totalOrderCount,
          completedOrderCount: summary.completedOrderCount,
          orderCount: summary.totalOrderCount,
          itemCount:
            summary.pendingItemCount +
            summary.readyToShipItemCount +
            summary.shippedItemCount,
        };
      })
      .filter((summary) => summary.orderCount > 0)
      .filter((summary) =>
        keyword
          ? summary.customerName.toLowerCase().includes(keyword.toLowerCase())
          : true,
      );
  }, [data, search, statusFilter]);

  const pagedSummaries = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredSummaries.slice(start, start + pageSize);
  }, [filteredSummaries, pageIndex, pageSize]);

  const hasPrevPage = pageIndex > 0;
  const hasNextPage = (pageIndex + 1) * pageSize < filteredSummaries.length;
  const orderCountLabel =
    statusFilter === "readyToShip"
      ? "可出貨訂單數量"
      : statusFilter === "shipped"
        ? "已出貨訂單數量"
        : "訂單數量";
  const itemCountLabel =
    statusFilter === "readyToShip"
      ? "可出貨品項數量"
      : statusFilter === "shipped"
        ? "已出貨品項數量"
        : "品項數量";
  const currentLabel =
    STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)
      ?.label ?? "可出貨";

  return (
    <Stack spacing={2}>
      <PageHeader
        section="客戶出貨"
        current={`${currentLabel}列表`}
        title="客戶出貨"
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          size="small"
          label="搜尋客戶"
          placeholder="輸入客戶名稱"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPageIndex(0);
          }}
          sx={{ maxWidth: 320 }}
        />
        <TextField
          select
          size="small"
          label="出貨狀態"
          value={statusFilter}
          onChange={(event) => {
            void navigate({
              to: ".",
              search: (current) => ({
                ...current,
                status: normalizeShipmentStatusFilter(event.target.value),
              }),
              replace: true,
            });
            setPageIndex(0);
          }}
          sx={{ maxWidth: 220 }}
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {error ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : "查詢客戶出貨列表失敗"}
        </Alert>
      ) : null}

      <CustomerShipmentSummaryTable
        summaries={pagedSummaries}
        isLoading={isLoading}
        orderCountLabel={orderCountLabel}
        itemCountLabel={itemCountLabel}
        onSelectCustomer={(customerId) => {
          void navigate({
            to: "/customer-shipments/$customerId",
            params: { customerId },
            search: { status: statusFilter },
          });
        }}
      />

      <CursorPagination
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPageIndex(0);
        }}
        hasNextPage={hasNextPage}
        hasPrevPage={hasPrevPage}
        onNextPage={() => {
          if (hasNextPage) {
            setPageIndex((current) => current + 1);
          }
        }}
        onPrevPage={() => {
          if (hasPrevPage) {
            setPageIndex((current) => current - 1);
          }
        }}
        currentCount={pagedSummaries.length}
      />
    </Stack>
  );
}
