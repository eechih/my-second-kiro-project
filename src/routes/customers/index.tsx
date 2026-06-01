import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import {
  useCustomerList,
  useUpdateCustomer,
  type StatusFilter,
} from "@/hooks/useCustomers";
import { requireAuth } from "@/lib/route-guards";
import type { SortField } from "@/lib/table-utils";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import type { Customer, UpdateCustomerInput } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  CustomerTable,
  type EditableCustomerField,
} from "./-components/CustomerTable";
import { CustomerToolbar } from "./-components/CustomerToolbar";

export const Route = createFileRoute("/customers/")({
  beforeLoad: requireAuth,
  component: CustomerListPage,
});

function CustomerListPage(): React.ReactElement {
  const navigate = useNavigate();

  // --- 工具列狀態 ---
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");

  // --- 分頁狀態 ---
  const pagination = useCursorPagination(25);

  // --- 批次選取狀態 ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);

  // --- 資料查詢 ---
  const isActive =
    statusFilter === "all" ? undefined : statusFilter === "active";
  const { data, isLoading } = useCustomerList({
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
    search: search || undefined,
    isActive,
    sortField,
  });

  const customerIds = useMemo(() => data?.items ?? [], [data?.items]);
  const nextToken = data?.nextToken;

  // --- Mutations ---
  const updateMutation = useUpdateCustomer();

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

  const handleSortFieldChange = useCallback((value: SortField): void => {
    setSortField(value);
  }, []);

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
    customerIds.length > 0 && selectedIds.size === customerIds.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < customerIds.length;

  const handleSelectAll = useCallback((): void => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customerIds));
    }
  }, [allSelected, customerIds]);

  const handleSelectRow = useCallback((customerId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }, []);

  const handleEdit = useCallback(
    (customer: Customer): void => {
      void navigate({
        to: "/customers/$customerId",
        params: { customerId: customer.id },
        search: { edit: true },
      });
    },
    [navigate],
  );

  const handleCellEdit = useCallback(
    async (
      customer: Customer,
      field: EditableCustomerField,
      value: string | boolean,
    ): Promise<void> => {
      if (field === "isActive" && value === customer.isActive) return;

      const nextValue = typeof value === "string" ? value.trim() : value;
      if (field === "name" && !nextValue) {
        const message = "客戶名稱為必填";
        setError(message);
        throw new Error(message);
      }

      setError(null);
      const updates: UpdateCustomerInput = {
        id: customer.id,
        [field]: nextValue,
      };

      try {
        await updateMutation.mutateAsync(updates);
      } catch (err) {
        const message = err instanceof Error ? err.message : "更新客戶失敗";
        setError(message);
        throw err;
      }
    },
    [updateMutation],
  );

  return (
    <Box>
      <PageHeader section="客戶" current="列表" title="列表" />

      {/* 錯誤提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 工具列 - 需求 1.1–1.7 */}
      <CustomerToolbar
        search={search}
        onSearchChange={handleSearchChange}
        totalCount={data?.totalCount ?? 0}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        sortField={sortField}
        onSortFieldChange={handleSortFieldChange}
        onAddClick={() => void navigate({ to: "/customers/new" })}
      />

      <CustomerTable
        customerIds={customerIds}
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
        currentCount={customerIds.length}
      />

    </Box>
  );
}
