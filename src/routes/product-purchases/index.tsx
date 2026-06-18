import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import {
  useProductPurchaseSummaries,
  type ProductPurchaseSummary,
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
  const [supplierFilter, setSupplierFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const { data, isLoading, error } = useProductPurchaseSummaries(statusFilter);

  const handleSearchChange = useCallback((value: string): void => {
    setSearch(value);
    setPageIndex(0);
  }, []);

  const handleStatusFilterChange = useCallback(
    (value: ProductPurchaseStatusFilter): void => {
      setStatusFilter(value);
      setPageIndex(0);
    },
    [],
  );

  const handleSupplierFilterChange = useCallback((value: string): void => {
    setSupplierFilter(value);
    setPageIndex(0);
  }, []);

  const supplierOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        (data ?? [])
          .map((summary) => summary.supplierName?.trim() ?? "")
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "zh-Hant"));

    return [
      { value: "", label: "全部供應商" },
      ...names.map((name) => ({
        value: name,
        label: name,
      })),
    ];
  }, [data]);

  const filteredSummaries = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return (data ?? [])
      .filter((summary) => {
        if (statusFilter === "all") {
          return summary.totalQuantity > 0;
        }

        return summary.statusQuantities[statusFilter] > 0;
      })
      .filter((summary) =>
        supplierFilter
          ? (summary.supplierName?.trim() ?? "") === supplierFilter
          : true,
      )
      .filter((summary) =>
        keyword
          ? matchesProductPurchaseKeyword(summary, keyword)
          : true,
      );
  }, [data, search, statusFilter, supplierFilter]);

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
        supplierFilter={supplierFilter}
        onSupplierFilterChange={handleSupplierFilterChange}
        supplierOptions={supplierOptions}
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

function matchesProductPurchaseKeyword(
  summary: ProductPurchaseSummary,
  keyword: string,
): boolean {
  const productName = summary.productName.toLowerCase();
  const supplierName = summary.supplierName?.toLowerCase() ?? "";

  return (
    productName.includes(keyword) ||
    supplierName.includes(keyword)
  );
}
