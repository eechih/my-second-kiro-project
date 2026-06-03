import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { useProductList } from "@/hooks/useProducts";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { ProductPurchasesTable } from "./-components/ProductPurchasesTable";
import {
  ProductPurchasesToolbar,
  type ProductPurchaseStatusFilter,
} from "./-components/ProductPurchasesToolbar";

export const Route = createFileRoute("/product-purchases/")({
  beforeLoad: requireAuth,
  component: ProductPurchasesPage,
});

function ProductPurchasesPage(): React.ReactElement {
  const navigate = useNavigate();
  const pagination = useCursorPagination(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ProductPurchaseStatusFilter>("all");

  const { data, isLoading, error } = useProductList({
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
    search: search || undefined,
  });

  const productIds = useMemo(() => data?.items ?? [], [data?.items]);
  const nextToken = data?.nextToken;

  const handleSearchChange = useCallback(
    (value: string): void => {
      setSearch(value);
      pagination.reset();
    },
    [pagination],
  );

  const handleStatusFilterChange = useCallback(
    (value: ProductPurchaseStatusFilter): void => {
      setStatusFilter(value);
    },
    [],
  );

  return (
    <Box>
      <PageHeader section="單品採購" current="列表" title="單品採購" />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "載入商品資料失敗"}
        </Alert>
      ) : null}

      <ProductPurchasesToolbar
        search={search}
        onSearchChange={handleSearchChange}
        totalCount={data?.totalCount ?? 0}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        onBackClick={() => void navigate({ to: "/orders" })}
      />

      <ProductPurchasesTable
        productIds={productIds}
        isLoading={isLoading}
        statusFilter={statusFilter}
      />

      <CursorPagination
        pageSize={pagination.pageSize}
        onPageSizeChange={pagination.setPageSize}
        hasNextPage={!!nextToken}
        hasPrevPage={pagination.tokenStack.length > 0}
        onNextPage={() => {
          if (nextToken) pagination.goNext(nextToken);
        }}
        onPrevPage={pagination.goPrev}
        currentCount={productIds.length}
      />
    </Box>
  );
}
