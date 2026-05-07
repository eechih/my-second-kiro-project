import { CursorPagination } from "@/components/CursorPagination";
import {
  EditableStatusCell,
  EditableTextCell,
} from "@/components/EditableCell";
import { listTableBodyTextSx } from "@/components/listTableStyles";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import {
  useActivateCustomer,
  useCustomer,
  useCustomerList,
  useDeactivateCustomer,
  useUpdateCustomer,
  type StatusFilter,
} from "@/hooks/useCustomers";
import { getAvatarColor, getAvatarLetter } from "@/lib/avatar-utils";
import {
  generateCustomerCsv,
  getCustomerCsvFilename,
} from "@/lib/customer-csv";
import { requireAuth } from "@/lib/route-guards";
import type { SortField } from "@/lib/table-utils";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { Customer, UpdateCustomerInput } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CustomerToolbar } from "./-components/CustomerToolbar";
import { RowActions } from "./-components/RowActions";

export const Route = createFileRoute("/customers/")({
  beforeLoad: requireAuth,
  component: CustomerListPage,
});

type EditableCustomerField =
  | "name"
  | "contactPerson"
  | "phone"
  | "email"
  | "address";

function CustomerListPage(): React.ReactElement {
  const navigate = useNavigate();

  // --- 工具列狀態 ---
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [isExporting, setIsExporting] = useState(false);

  // --- 分頁狀態 ---
  const pagination = useCursorPagination(10);

  // --- 批次選取狀態 ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadedCustomers, setLoadedCustomers] = useState<
    Map<string, Customer>
  >(new Map());

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
  const deactivateMutation = useDeactivateCustomer();
  const activateMutation = useActivateCustomer();
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
      value: string,
    ): Promise<void> => {
      const nextValue = value.trim();
      if (
        (field === "name" || field === "contactPerson" || field === "phone") &&
        !nextValue
      ) {
        const message =
          field === "name"
            ? "客戶名稱為必填"
            : field === "contactPerson"
              ? "聯絡人為必填"
              : "電話為必填";
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

  const handleStatusEdit = useCallback(
    async (customer: Customer, isActive: boolean): Promise<void> => {
      if (customer.isActive === isActive) return;

      setError(null);
      try {
        if (isActive) {
          await activateMutation.mutateAsync({ customerId: customer.id });
        } else {
          await deactivateMutation.mutateAsync({ customerId: customer.id });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新客戶狀態失敗");
      }
    },
    [activateMutation, deactivateMutation],
  );

  const handleCustomerLoaded = useCallback((customer: Customer): void => {
    setLoadedCustomers((prev) => {
      const current = prev.get(customer.id);
      if (
        current &&
        current.name === customer.name &&
        current.contactPerson === customer.contactPerson &&
        current.phone === customer.phone &&
        current.email === customer.email &&
        current.address === customer.address &&
        current.isActive === customer.isActive &&
        current.updatedAt === customer.updatedAt
      ) {
        return prev;
      }

      const next = new Map(prev);
      next.set(customer.id, customer);
      return next;
    });
  }, []);

  // --- CSV 匯出 ---
  const handleExport = useCallback((): void => {
    if (customerIds.length === 0) {
      setError("目前無資料可匯出");
      return;
    }

    const customers = customerIds
      .map((customerId) => loadedCustomers.get(customerId))
      .filter((customer): customer is Customer => !!customer);

    if (customers.length !== customerIds.length) {
      setError("客戶資料尚未載入完成，請稍後再匯出");
      return;
    }

    setIsExporting(true);
    try {
      const csv = generateCustomerCsv(customers);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getCustomerCsvFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯出失敗");
    } finally {
      setIsExporting(false);
    }
  }, [customerIds, loadedCustomers]);

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
        onExportClick={handleExport}
        isExporting={isExporting}
      />

      {/* 表格 - 需求 2.1–2.4, 3.1–3.4, 4.1–4.6, 5.1–5.4 */}
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table sx={listTableBodyTextSx}>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleSelectAll}
                    size="small"
                  />
                </TableCell>
                <TableCell>客戶資訊</TableCell>
                <TableCell>電話</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>地址</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customerIds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 4 }}
                  >
                    <Typography color="text.secondary">
                      目前沒有符合條件的客戶資料
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                customerIds.map((customerId) => (
                  <CustomerTableRow
                    key={customerId}
                    customerId={customerId}
                    selected={selectedIds.has(customerId)}
                    statusDisabled={
                      activateMutation.isPending ||
                      deactivateMutation.isPending
                    }
                    onSelect={handleSelectRow}
                    onEdit={handleEdit}
                    onCellEdit={handleCellEdit}
                    onStatusEdit={handleStatusEdit}
                    onCustomerLoaded={handleCustomerLoaded}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

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

interface CustomerTableRowProps {
  customerId: string;
  selected: boolean;
  statusDisabled: boolean;
  onSelect: (customerId: string) => void;
  onEdit: (customer: Customer) => void;
  onCellEdit: (
    customer: Customer,
    field: EditableCustomerField,
    value: string,
  ) => Promise<void>;
  onStatusEdit: (customer: Customer, isActive: boolean) => Promise<void>;
  onCustomerLoaded: (customer: Customer) => void;
}

function CustomerTableRow({
  customerId,
  selected,
  statusDisabled,
  onSelect,
  onEdit,
  onCellEdit,
  onStatusEdit,
  onCustomerLoaded,
}: CustomerTableRowProps): React.ReactElement {
  const { data: customer, isLoading, error } = useCustomer(customerId);

  useEffect(() => {
    if (customer) onCustomerLoaded(customer);
  }, [customer, onCustomerLoaded]);

  if (isLoading) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(customerId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={6}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography color="text.secondary">載入客戶資料中...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  if (error || !customer) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(customerId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={6}>
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢客戶失敗"}
          </Alert>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow selected={selected} hover>
      <TableCell>
        <Checkbox
          checked={selected}
          onChange={() => onSelect(customer.id)}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: getAvatarColor(customer.name),
              width: 36,
              height: 36,
              fontSize: "0.875rem",
            }}
          >
            {getAvatarLetter(customer.name)}
          </Avatar>
          <Box>
            <EditableTextCell
              value={customer.name}
              onCommit={(value) => onCellEdit(customer, "name", value)}
            />
            {customer.contactPerson !== customer.name && (
              <EditableTextCell
                value={customer.contactPerson}
                onCommit={(value) =>
                  onCellEdit(customer, "contactPerson", value)
                }
              />
            )}
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={customer.phone}
          onCommit={(value) => onCellEdit(customer, "phone", value)}
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={customer.email}
          onCommit={(value) => onCellEdit(customer, "email", value)}
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={customer.address}
          onCommit={(value) => onCellEdit(customer, "address", value)}
        />
      </TableCell>
      <TableCell>
        <EditableStatusCell
          isActive={customer.isActive}
          disabled={statusDisabled}
          onCommit={(isActive) => onStatusEdit(customer, isActive)}
        />
      </TableCell>
      <TableCell>
        <RowActions customer={customer} onEdit={onEdit} />
      </TableCell>
    </TableRow>
  );
}
