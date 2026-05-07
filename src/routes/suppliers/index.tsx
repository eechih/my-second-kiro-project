import { CursorPagination } from "@/components/CursorPagination";
import {
  EditableStatusCell,
  EditableTextCell,
} from "@/components/EditableCell";
import { listTableBodyTextSx } from "@/components/listTableStyles";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import {
  useSupplier,
  useSupplierList,
  useUpdateSupplier,
  type StatusFilter,
  type SupplierSortField,
} from "@/hooks/useSuppliers";
import { getAvatarColor, getAvatarLetter } from "@/lib/avatar-utils";
import { requireAuth } from "@/lib/route-guards";
import {
  generateSupplierCsv,
  getSupplierCsvFilename,
} from "@/lib/supplier-csv";
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
import type { Supplier, UpdateSupplierInput } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SupplierRowActions } from "./-components/SupplierRowActions";
import { SupplierToolbar } from "./-components/SupplierToolbar";

export const Route = createFileRoute("/suppliers/")({
  beforeLoad: requireAuth,
  component: SupplierListPage,
});

type EditableSupplierField =
  | "name"
  | "contactPerson"
  | "phone"
  | "email"
  | "address"
  | "isActive";

function SupplierListPage(): React.ReactElement {
  const navigate = useNavigate();

  // --- 工具列狀態 ---
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SupplierSortField>("name");
  const [isExporting, setIsExporting] = useState(false);

  // --- 分頁狀態 ---
  const pagination = useCursorPagination(10);

  // --- 批次選取狀態 ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadedSuppliers, setLoadedSuppliers] = useState<Map<string, Supplier>>(
    new Map(),
  );

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
      if (
        (field === "name" || field === "contactPerson" || field === "phone") &&
        !nextValue
      ) {
        const message =
          field === "name"
            ? "供應商名稱為必填"
            : field === "contactPerson"
              ? "聯絡人為必填"
              : "電話為必填";
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

  const handleSupplierLoaded = useCallback((supplier: Supplier): void => {
    setLoadedSuppliers((prev) => {
      const current = prev.get(supplier.id);
      if (
        current &&
        current.name === supplier.name &&
        current.contactPerson === supplier.contactPerson &&
        current.phone === supplier.phone &&
        current.email === supplier.email &&
        current.address === supplier.address &&
        current.isActive === supplier.isActive &&
        current.updatedAt === supplier.updatedAt
      ) {
        return prev;
      }

      const next = new Map(prev);
      next.set(supplier.id, supplier);
      return next;
    });
  }, []);

  // --- CSV 匯出 ---
  const handleExport = useCallback((): void => {
    if (supplierIds.length === 0) {
      setError("目前無資料可匯出");
      return;
    }

    const suppliers = supplierIds
      .map((supplierId) => loadedSuppliers.get(supplierId))
      .filter((supplier): supplier is Supplier => !!supplier);

    if (suppliers.length !== supplierIds.length) {
      setError("供應商資料尚未載入完成，請稍後再匯出");
      return;
    }

    setIsExporting(true);
    try {
      const csv = generateSupplierCsv(suppliers);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getSupplierCsvFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯出失敗");
    } finally {
      setIsExporting(false);
    }
  }, [supplierIds, loadedSuppliers]);

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
                <TableCell>供應商資訊</TableCell>
                <TableCell>電話</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>地址</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {supplierIds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 4 }}
                  >
                    <Typography color="text.secondary">
                      目前沒有符合條件的供應商資料
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                supplierIds.map((supplierId) => (
                  <SupplierTableRow
                    key={supplierId}
                    supplierId={supplierId}
                    selected={selectedIds.has(supplierId)}
                    statusDisabled={updateMutation.isPending}
                    onSelect={handleSelectRow}
                    onEdit={handleEdit}
                    onCellEdit={handleCellEdit}
                    onSupplierLoaded={handleSupplierLoaded}
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
        currentCount={supplierIds.length}
      />

    </Box>
  );
}

interface SupplierTableRowProps {
  supplierId: string;
  selected: boolean;
  statusDisabled: boolean;
  onSelect: (supplierId: string) => void;
  onEdit: (supplier: Supplier) => void;
  onCellEdit: (
    supplier: Supplier,
    field: EditableSupplierField,
    value: string | boolean,
  ) => Promise<void>;
  onSupplierLoaded: (supplier: Supplier) => void;
}

function SupplierTableRow({
  supplierId,
  selected,
  statusDisabled,
  onSelect,
  onEdit,
  onCellEdit,
  onSupplierLoaded,
}: SupplierTableRowProps): React.ReactElement {
  const { data: supplier, isLoading, error } = useSupplier(supplierId);

  useEffect(() => {
    if (supplier) onSupplierLoaded(supplier);
  }, [supplier, onSupplierLoaded]);

  if (isLoading) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(supplierId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={6}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography color="text.secondary">載入供應商資料中...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  if (error || !supplier) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(supplierId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={6}>
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢供應商失敗"}
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
          onChange={() => onSelect(supplier.id)}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: getAvatarColor(supplier.name),
              width: 36,
              height: 36,
              fontSize: "0.875rem",
            }}
          >
            {getAvatarLetter(supplier.name)}
          </Avatar>
          <Box>
            <EditableTextCell
              value={supplier.name}
              onCommit={(value) => onCellEdit(supplier, "name", value)}
            />
            {supplier.contactPerson !== supplier.name && (
              <EditableTextCell
                value={supplier.contactPerson}
                onCommit={(value) =>
                  onCellEdit(supplier, "contactPerson", value)
                }
              />
            )}
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={supplier.phone}
          onCommit={(value) => onCellEdit(supplier, "phone", value)}
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={supplier.email}
          onCommit={(value) => onCellEdit(supplier, "email", value)}
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={supplier.address}
          onCommit={(value) => onCellEdit(supplier, "address", value)}
        />
      </TableCell>
      <TableCell>
        <EditableStatusCell
          isActive={supplier.isActive}
          disabled={statusDisabled}
          onCommit={(isActive) => onCellEdit(supplier, "isActive", isActive)}
        />
      </TableCell>
      <TableCell>
        <SupplierRowActions supplier={supplier} onEdit={onEdit} />
      </TableCell>
    </TableRow>
  );
}
