import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import {
  useProductPurchaseSummaries,
  type ProductPurchaseStatusFilter,
} from "@/hooks/useProductPurchases";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { ProductPurchasesTable } from "./-components/ProductPurchasesTable";
import { ProductPurchasesToolbar } from "./-components/ProductPurchasesToolbar";

export const Route = createFileRoute("/product-purchases/")({
  beforeLoad: requireAuth,
  component: ProductPurchasesPage,
});

function ProductPurchasesPage(): React.ReactElement {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ProductPurchaseStatusFilter>("pending");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const { data, isLoading, error } = useProductPurchaseSummaries(statusFilter);

  const handleSearchChange = useCallback(
    (value: string): void => {
      setSearch(value);
      setPageIndex(0);
    },
    [],
  );

  const handleStatusFilterChange = useCallback(
    (value: ProductPurchaseStatusFilter): void => {
      setStatusFilter(value);
      setPageIndex(0);
    },
    [],
  );

  const filteredSummaries = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return (data ?? [])
      .filter((summary) => {
        if (statusFilter === "pending") {
          return summary.unorderedQuantity > 0;
        }

        if (statusFilter === "ordered") {
          return summary.orderedQuantity > 0;
        }

        return summary.unorderedQuantity > 0 || summary.orderedQuantity > 0;
      })
      .filter((summary) =>
        keyword ? summary.productName.toLowerCase().includes(keyword) : true,
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
      <PageHeader section="單品採購" current="列表" title="單品採購" />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "查詢單品採購資料失敗"}
        </Alert>
      ) : null}

      <ProductPurchasesToolbar
        search={search}
        onSearchChange={handleSearchChange}
        totalCount={filteredSummaries.length}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        onBackClick={() => void navigate({ to: "/orders" })}
      />

      <ProductPurchasesTable
        summaries={pagedSummaries}
        isLoading={isLoading}
        onSelectProduct={(summary) =>
          void navigate({
            to: "/product-purchases/$productId",
            params: { productId: summary.productId },
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
