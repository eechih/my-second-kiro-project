import { ConfirmDialog } from "@/components/ConfirmDialog";
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
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { CustomerToolbar } from "./-components/CustomerToolbar";
import { RowActions } from "./-components/RowActions";

export const Route = createFileRoute("/customers/")({
  beforeLoad: requireAuth,
  component: CustomerListPage,
});

const columnHelper = createColumnHelper<Customer>();

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

  // --- 確認對話框狀態 ---
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    customer: Customer | null;
    action: "deactivate" | "activate";
  }>({ open: false, customer: null, action: "deactivate" });
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

  const customers = useMemo(() => data?.items ?? [], [data?.items]);
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
    customers.length > 0 && selectedIds.size === customers.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < customers.length;

  const handleSelectAll = useCallback((): void => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.id)));
    }
  }, [allSelected, customers]);

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

  const handleToggleActive = useCallback((customer: Customer): void => {
    setConfirmDialog({
      open: true,
      customer,
      action: customer.isActive ? "deactivate" : "activate",
    });
  }, []);

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

  const handleConfirm = async (): Promise<void> => {
    const { customer, action } = confirmDialog;
    if (!customer) return;

    setError(null);
    try {
      if (action === "deactivate") {
        await deactivateMutation.mutateAsync({ customerId: customer.id });
      } else {
        await activateMutation.mutateAsync({ customerId: customer.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setConfirmDialog({ open: false, customer: null, action: "deactivate" });
    }
  };

  const handleCancel = (): void => {
    setConfirmDialog({ open: false, customer: null, action: "deactivate" });
  };

  // --- CSV 匯出 ---
  const handleExport = useCallback((): void => {
    if (customers.length === 0) {
      setError("目前無資料可匯出");
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
  }, [customers]);

  // --- TanStack Table 欄位定義 ---
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: () => (
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={handleSelectAll}
            size="small"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onChange={() => handleSelectRow(row.original.id)}
            size="small"
          />
        ),
        enableSorting: false,
      }),
      columnHelper.display({
        id: "customerInfo",
        header: "客戶資訊",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              sx={{
                bgcolor: getAvatarColor(row.original.name),
                width: 36,
                height: 36,
                fontSize: "0.875rem",
              }}
            >
              {getAvatarLetter(row.original.name)}
            </Avatar>
            <Box>
              <EditableTextCell
                value={row.original.name}
                onCommit={(value) =>
                  handleCellEdit(row.original, "name", value)
                }
              />
              {row.original.contactPerson !== row.original.name && (
                <EditableTextCell
                  value={row.original.contactPerson}
                  onCommit={(value) =>
                    handleCellEdit(row.original, "contactPerson", value)
                  }
                />
              )}
            </Box>
          </Box>
        ),
      }),
      columnHelper.accessor("phone", {
        header: "電話",
        cell: ({ row, getValue }) => (
          <EditableTextCell
            value={getValue<string>()}
            onCommit={(value) => handleCellEdit(row.original, "phone", value)}
          />
        ),
      }),
      columnHelper.accessor("email", {
        header: "Email",
        cell: ({ row, getValue }) => (
          <EditableTextCell
            value={getValue<string>()}
            onCommit={(value) => handleCellEdit(row.original, "email", value)}
          />
        ),
      }),
      columnHelper.accessor("address", {
        header: "地址",
        cell: ({ row, getValue }) => (
          <EditableTextCell
            value={getValue<string>()}
            onCommit={(value) => handleCellEdit(row.original, "address", value)}
          />
        ),
      }),
      columnHelper.display({
        id: "status",
        header: "狀態",
        cell: ({ row }) => (
          <EditableStatusCell
            isActive={row.original.isActive}
            disabled={
              activateMutation.isPending || deactivateMutation.isPending
            }
            onCommit={(isActive) => handleStatusEdit(row.original, isActive)}
          />
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <RowActions
            customer={row.original}
            onEdit={handleEdit}
            onToggleActive={handleToggleActive}
          />
        ),
        enableSorting: false,
      }),
    ],
    [
      allSelected,
      someSelected,
      selectedIds,
      handleSelectAll,
      handleSelectRow,
      handleEdit,
      handleToggleActive,
      handleCellEdit,
      handleStatusEdit,
      activateMutation.isPending,
      deactivateMutation.isPending,
    ],
  );

  const table = useReactTable({
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableCell key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    align="center"
                    sx={{ py: 4 }}
                  >
                    <Typography color="text.secondary">
                      目前沒有符合條件的客戶資料
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    selected={selectedIds.has(row.original.id)}
                    hover
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
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
        currentCount={customers.length}
      />

      {/* 確認對話框 - 需求 4.4, 4.5 */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.action === "deactivate" ? "停用客戶" : "啟用客戶"}
        message={
          confirmDialog.action === "deactivate"
            ? `確定要停用客戶「${confirmDialog.customer?.name ?? ""}」嗎？停用後將不會出現在訂單建立的客戶選取清單中。`
            : `確定要重新啟用客戶「${confirmDialog.customer?.name ?? ""}」嗎？`
        }
        confirmLabel={confirmDialog.action === "deactivate" ? "停用" : "啟用"}
        confirmColor={
          confirmDialog.action === "deactivate" ? "warning" : "primary"
        }
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
}
