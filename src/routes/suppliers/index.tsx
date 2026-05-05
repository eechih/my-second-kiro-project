import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { type ColumnDef } from "@tanstack/react-table";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { DataTable } from "@/components/DataTable";
import { SearchBar } from "@/components/SearchBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useSupplierList,
  useDeactivateSupplier,
  useActivateSupplier,
} from "@/hooks/useSuppliers";
import type { Supplier } from "@shared/models";

export const Route = createFileRoute("/suppliers/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: SupplierListPage,
});

function SupplierListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"active" | "inactive">(
    "active",
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    supplier: Supplier | null;
    action: "deactivate" | "activate";
  }>({ open: false, supplier: null, action: "deactivate" });
  const [error, setError] = useState<string | null>(null);

  const isActive = isActiveFilter === "active";

  const { data, isLoading } = useSupplierList({ page, search, isActive });
  const deactivateMutation = useDeactivateSupplier();
  const activateMutation = useActivateSupplier();

  const handleFilterChange = (
    _event: React.MouseEvent<HTMLElement>,
    newValue: "active" | "inactive" | null,
  ): void => {
    if (newValue !== null) {
      setIsActiveFilter(newValue);
      setPage(0);
    }
  };

  const handleDeactivateClick = (
    event: React.MouseEvent,
    supplier: Supplier,
  ): void => {
    event.stopPropagation();
    setConfirmDialog({ open: true, supplier, action: "deactivate" });
  };

  const handleActivateClick = (
    event: React.MouseEvent,
    supplier: Supplier,
  ): void => {
    event.stopPropagation();
    setConfirmDialog({ open: true, supplier, action: "activate" });
  };

  const handleConfirm = async (): Promise<void> => {
    const { supplier, action } = confirmDialog;
    if (!supplier) return;

    setError(null);
    try {
      if (action === "deactivate") {
        await deactivateMutation.mutateAsync({ supplierId: supplier.id });
      } else {
        await activateMutation.mutateAsync({ supplierId: supplier.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setConfirmDialog({ open: false, supplier: null, action: "deactivate" });
    }
  };

  const handleCancel = (): void => {
    setConfirmDialog({ open: false, supplier: null, action: "deactivate" });
  };

  const columns: ColumnDef<Supplier, unknown>[] = [
    {
      accessorKey: "name",
      header: "供應商名稱",
    },
    {
      accessorKey: "contactPerson",
      header: "聯絡人",
    },
    {
      accessorKey: "phone",
      header: "電話",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "address",
      header: "地址",
    },
    {
      id: "actions",
      header: "操作",
      enableSorting: false,
      cell: ({ row }) => {
        const supplier = row.original;
        if (supplier.isActive) {
          return (
            <Tooltip title="停用">
              <IconButton
                size="small"
                color="warning"
                onClick={(e) => handleDeactivateClick(e, supplier)}
              >
                <BlockIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="啟用">
            <IconButton
              size="small"
              color="success"
              onClick={(e) => handleActivateClick(e, supplier)}
            >
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4">供應商管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate({ to: "/suppliers/new" })}
        >
          新增供應商
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <SearchBar
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(0);
          }}
          placeholder="搜尋供應商名稱、聯絡人或電話..."
        />
        <ToggleButtonGroup
          value={isActiveFilter}
          exclusive
          onChange={handleFilterChange}
          size="small"
        >
          <ToggleButton value="active">啟用中</ToggleButton>
          <ToggleButton value="inactive">已停用</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <DataTable<Supplier>
        columns={columns}
        data={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(0);
        }}
        isLoading={isLoading}
        onRowClick={(supplier) =>
          navigate({
            to: "/suppliers/$supplierId",
            params: { supplierId: supplier.id },
          })
        }
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={
          confirmDialog.action === "deactivate" ? "停用供應商" : "啟用供應商"
        }
        message={
          confirmDialog.action === "deactivate"
            ? `確定要停用供應商「${confirmDialog.supplier?.name ?? ""}」嗎？停用後將不會出現在進貨操作的供應商選取清單中。`
            : `確定要重新啟用供應商「${confirmDialog.supplier?.name ?? ""}」嗎？`
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
