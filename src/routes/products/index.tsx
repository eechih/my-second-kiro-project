import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import type { ProductStatusFilter } from "@/hooks/useProducts";
import {
  useProductList,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import type { Product, UpdateProductInput } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  ProductTable,
  type EditableProductField,
  type SupplierOption,
} from "./-components/ProductTable";
import { ProductToolbar } from "./-components/ProductToolbar";

export const Route = createFileRoute("/products/")({
  beforeLoad: requireAuth,
  component: ProductListPage,
});

function ProductListPage(): React.ReactElement {
  const navigate = useNavigate();
  const pagination = useCursorPagination(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isActive =
    statusFilter === "all" ? undefined : statusFilter === "active";

  const { data, isLoading } = useProductList({
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
    search: search || undefined,
    isActive,
  });

  const productIds = useMemo(() => data?.items ?? [], [data?.items]);
  const nextToken = data?.nextToken;

  const searchSuppliers = useCallback(
    async (query: string): Promise<SupplierOption[]> => {
      const filter: Record<string, unknown> = { isActive: { eq: true } };
      if (query) {
        filter.or = [{ name: { contains: query } }];
      }

      const { data: suppliers } = await client.models.Supplier.list({
        filter,
        limit: 20,
        selectionSet: ["id", "name"],
      });

      return (suppliers ?? []).map((supplier) => ({
        id: String(supplier.id ?? ""),
        name: String(supplier.name ?? ""),
      }));
    },
    [],
  );

  const updateMutation = useUpdateProduct();

  const handleSearchChange = useCallback(
    (value: string): void => {
      setSearch(value);
      setSelectedIds(new Set());
      pagination.reset();
    },
    [pagination],
  );

  const handleStatusFilterChange = useCallback(
    (value: ProductStatusFilter): void => {
      setStatusFilter(value);
      setSelectedIds(new Set());
      pagination.reset();
    },
    [pagination],
  );

  const handlePageSizeChange = useCallback(
    (size: number): void => {
      setSelectedIds(new Set());
      pagination.setPageSize(size);
    },
    [pagination],
  );

  const handleNextPage = useCallback((): void => {
    if (nextToken) {
      setSelectedIds(new Set());
      pagination.goNext(nextToken);
    }
  }, [nextToken, pagination]);

  const handlePrevPage = useCallback((): void => {
    setSelectedIds(new Set());
    pagination.goPrev();
  }, [pagination]);

  const allSelected =
    productIds.length > 0 && selectedIds.size === productIds.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < productIds.length;

  const handleSelectAll = useCallback((): void => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(productIds));
    }
  }, [allSelected, productIds]);

  const handleSelectRow = useCallback((productId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const handleEdit = useCallback(
    (product: Product): void => {
      void navigate({
        to: "/products/$productId",
        params: { productId: product.id },
        search: { edit: true },
      });
    },
    [navigate],
  );

  const handleCellEdit = useCallback(
    async (
      product: Product,
      field: EditableProductField,
      value: string | number | boolean | null,
    ): Promise<void> => {
      if (field === "isActive" && value === product.isActive) return;

      setError(null);

      if (field === "name" && typeof value === "string" && !value.trim()) {
        setError("商品名稱為必填");
        throw new Error("商品名稱為必填");
      }

      const updates: UpdateProductInput = {
        id: product.id,
        [field]: value,
      };

      try {
        await updateMutation.mutateAsync(updates);
      } catch (err) {
        const message = err instanceof Error ? err.message : "更新商品失敗";
        setError(message);
        throw err;
      }
    },
    [updateMutation],
  );

  return (
    <Box>
      <PageHeader section="商品" current="列表" title="列表" />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <ProductToolbar
        search={search}
        onSearchChange={handleSearchChange}
        totalCount={data?.totalCount ?? 0}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        onAddClick={() => void navigate({ to: "/products/new" })}
      />

      <ProductTable
        productIds={productIds}
        selectedIds={selectedIds}
        allSelected={allSelected}
        someSelected={someSelected}
        isLoading={isLoading}
        statusDisabled={updateMutation.isPending}
        searchSuppliers={searchSuppliers}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onEdit={handleEdit}
        onCellEdit={handleCellEdit}
      />

      <CursorPagination
        pageSize={pagination.pageSize}
        onPageSizeChange={handlePageSizeChange}
        hasNextPage={!!nextToken}
        hasPrevPage={pagination.tokenStack.length > 0}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        currentCount={productIds.length}
      />
    </Box>
  );
}
