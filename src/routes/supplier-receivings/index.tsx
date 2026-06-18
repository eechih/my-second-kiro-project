import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import {
  useSupplierReceivingSummaries,
  type SupplierReceivingStatusFilter,
} from "@/hooks/useSupplierReceivings";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { SupplierReceivingsTable } from "./-components/SupplierReceivingsTable";
import { SupplierReceivingsToolbar } from "./-components/SupplierReceivingsToolbar";

export const Route = createFileRoute("/supplier-receivings/")({
  beforeLoad: requireAuth,
  component: SupplierReceivingsPage,
});

function SupplierReceivingsPage(): React.ReactElement {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<SupplierReceivingStatusFilter>("ordered");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const { data, isLoading, error } = useSupplierReceivingSummaries(statusFilter);

  const handleSearchChange = useCallback((value: string): void => {
    setSearch(value);
    setPageIndex(0);
  }, []);

  const handleStatusFilterChange = useCallback(
    (value: SupplierReceivingStatusFilter): void => {
      setStatusFilter(value);
      setPageIndex(0);
    },
    [],
  );

  const filteredSummaries = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return (data ?? [])
      .filter((summary) =>
        statusFilter === "all"
          ? summary.totalQuantity > 0
          : summary.orderedQuantity > 0,
      )
      .filter((summary) =>
        keyword
          ? summary.supplierName.toLowerCase().includes(keyword)
          : true,
      );
  }, [data, search, statusFilter]);

  const pagedSummaries = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredSummaries.slice(start, start + pageSize);
  }, [filteredSummaries, pageIndex, pageSize]);

  const hasPrevPage = pageIndex > 0;
  const hasNextPage = (pageIndex + 1) * pageSize < filteredSummaries.length;

  return (
    <Box>
      <PageHeader section="供應商入庫" current="列表" title="供應商入庫" />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "查詢供應商入庫資料失敗"}
        </Alert>
      ) : null}

      <SupplierReceivingsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        totalCount={filteredSummaries.length}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
      />

      <SupplierReceivingsTable
        summaries={pagedSummaries}
        isLoading={isLoading}
        onSelectSupplier={(summary) =>
          void navigate({
            to: "/supplier-receivings/$supplierName",
            params: { supplierName: summary.supplierName },
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
    </Box>
  );
}
