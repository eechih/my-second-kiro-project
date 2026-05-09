import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import {
  useSupplierList,
  useUpdateSupplier,
  type StatusFilter,
  type SupplierSortField,
} from "@/hooks/useSuppliers";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import type { Supplier, UpdateSupplierInput } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  SupplierTable,
  type EditableSupplierField,
} from "./-components/SupplierTable";
import { SupplierToolbar } from "./-components/SupplierToolbar";

export const Route = createFileRoute("/suppliers/")({
  beforeLoad: requireAuth,
  component: SupplierListPage,
});

function SupplierListPage(): React.ReactElement {
  const navigate = useNavigate();

  // --- 工具列狀態 ---
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SupplierSortField>("name");

  // --- 分頁狀態 ---
  const pagination = useCursorPagination(10);

  // --- 批次選取狀態 ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);

  // --- 資料查詢 ---
  const isActive =
    statusFilter === "all" ? undefined : statusFilter === "active";
  const { data, isLoading } = useSupplierList({
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
    search: search || undefined,
    isActive,
    sortField,
  });

  const supplierIds = useMemo(() => data?.items ?? [], [data?.items]);
  const nextToken = data?.nextToken;

  // --- Mutations ---
  const updateMutation = useUpdateSupplier();

  // --- 篩選/搜尋/每頁筆數變更時重置分頁 ---
  const handleSearchChange = useCallback(
    (value: string): void => {
      setSearch(value);
      setSelectedIds(new Set());
      pagination.reset();
    },
    [pagination],
  );

  const handleStatusFilterChange = useCallback(
    (value: StatusFilter): void => {
      setStatusFilter(value);
      setSelectedIds(new Set());
      pagination.reset();
    },
    [pagination],
  );

  const handleSortFieldChange = useCallback(
    (value: SupplierSortField): void => {
      setSortField(value);
    },
    [],
  );

  const handlePageSizeChange = useCallback(
    (size: number): void => {
      setSelectedIds(new Set());
      pagination.setPageSize(size);
    },
    [pagination],
  );

  // --- 分頁導覽 ---
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

  // --- 批次選取邏輯 ---
  const allSelected =
    supplierIds.length > 0 && selectedIds.size === supplierIds.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < supplierIds.length;

  const handleSelectAll = useCallback((): void => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(supplierIds));
    }
  }, [allSelected, supplierIds]);

  const handleSelectRow = useCallback((supplierId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  }, []);

  const handleEdit = useCallback(
    (supplier: Supplier): void => {
      void navigate({
        to: "/suppliers/$supplierId",
        params: { supplierId: supplier.id },
        search: { edit: true },
      });
    },
    [navigate],
  );

  const handleCellEdit = useCallback(
    async (
      supplier: Supplier,
      field: EditableSupplierField,
      value: string | boolean,
    ): Promise<void> => {
      if (field === "isActive" && value === supplier.isActive) return;

      const nextValue = typeof value === "string" ? value.trim() : value;
      if (field === "name" && !nextValue) {
        const message = "供應商名稱為必填";
        setError(message);
        throw new Error(message);
      }

      setError(null);
      const updates: UpdateSupplierInput = {
        id: supplier.id,
        [field]: nextValue,
      };

      try {
        await updateMutation.mutateAsync(updates);
      } catch (err) {
        const message = err instanceof Error ? err.message : "更新供應商失敗";
        setError(message);
        throw err;
      }
    },
    [updateMutation],
  );

  return (
    <Box>
      <PageHeader section="供應商" current="列表" title="列表" />

      {/* 錯誤提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 工具列 - 需求 1.1–1.8 */}
      <SupplierToolbar
        search={search}
        onSearchChange={handleSearchChange}
        totalCount={data?.totalCount ?? 0}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        sortField={sortField}
        onSortFieldChange={handleSortFieldChange}
        onAddClick={() => void navigate({ to: "/suppliers/new" })}
      />

      <SupplierTable
        supplierIds={supplierIds}
        selectedIds={selectedIds}
        allSelected={allSelected}
        someSelected={someSelected}
        isLoading={isLoading}
        statusDisabled={updateMutation.isPending}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onEdit={handleEdit}
        onCellEdit={handleCellEdit}
      />

      {/* 分頁控制 - 需求 6.1–6.7 */}
      <CursorPagination
        pageSize={pagination.pageSize}
        onPageSizeChange={handlePageSizeChange}
        hasNextPage={!!nextToken}
        hasPrevPage={pagination.tokenStack.length > 0}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        currentCount={supplierIds.length}
      />

    </Box>
  );
}
