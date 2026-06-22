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
  const { data, isLoading, error } = useProductPurchaseSummaries(statusFilter);

  const handleSearchChange = useCallback((value: string): void => {
    setSearch(value);
  }, []);

  const handleStatusFilterChange = useCallback(
    (value: ProductPurchaseStatusFilter): void => {
      setStatusFilter(value);
    },
    [],
  );

  const filteredSummaries = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return (data ?? [])
      .filter((summary) => {
        return (summary.statusQuantities[statusFilter.toUpperCase()] ?? 0) > 0;
      })
      .filter((summary) =>
        keyword ? matchesProductPurchaseKeyword(summary, keyword) : true,
      );
  }, [data, search, statusFilter]);

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
      />

      <ProductPurchasesTable
        summaries={filteredSummaries}
        isLoading={isLoading}
        onSelectProduct={(summary) =>
          void navigate({
            to: "/product-purchases/$productId",
            params: { productId: summary.productId },
          })
        }
      />
    </Box>
  );
}

function matchesProductPurchaseKeyword(
  summary: ProductPurchaseSummary,
  keyword: string,
): boolean {
  const productName = summary.productName.toLowerCase();
  const productSku = summary.productSku?.toLowerCase() ?? "";
  const supplierName = summary.supplierName?.toLowerCase() ?? "";

  return (
    productName.includes(keyword) ||
    productSku.includes(keyword) ||
    supplierName.includes(keyword)
  );
}
