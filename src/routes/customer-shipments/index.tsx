import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import { usePendingShipmentCustomerSummaries } from "@/hooks/useCustomerShipments";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CustomerShipmentSummaryTable } from "./-components/CustomerShipmentSummaryTable";

export const Route = createFileRoute("/customer-shipments/")({
  beforeLoad: requireAuth,
  component: CustomerShipmentListPage,
});

function CustomerShipmentListPage(): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading, error } = usePendingShipmentCustomerSummaries();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const filteredSummaries = useMemo(() => {
    const keyword = search.trim();

    if (!keyword) {
      return data ?? [];
    }

    return (data ?? []).filter((summary) =>
      summary.customerName.toLowerCase().includes(keyword.toLowerCase()),
    );
  }, [data, search]);

  const pagedSummaries = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredSummaries.slice(start, start + pageSize);
  }, [filteredSummaries, pageIndex, pageSize]);

  const hasPrevPage = pageIndex > 0;
  const hasNextPage = (pageIndex + 1) * pageSize < filteredSummaries.length;

  return (
    <Stack spacing={2}>
      <PageHeader
        section="客戶出貨"
        current="待出貨列表"
        title="客戶出貨"
      />

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

      {error ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : "查詢客戶待出貨列表失敗"}
        </Alert>
      ) : null}

      <CustomerShipmentSummaryTable
        summaries={pagedSummaries}
        isLoading={isLoading}
        onSelectCustomer={(customerId) =>
          void navigate({
            to: "/customer-shipments/$customerId",
            params: { customerId },
          })
        }
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
