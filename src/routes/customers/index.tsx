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
  useCustomerList,
  useDeactivateCustomer,
  useActivateCustomer,
} from "@/hooks/useCustomers";
import type { Customer } from "@shared/models";

export const Route = createFileRoute("/customers/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: CustomerListPage,
});

function CustomerListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"active" | "inactive">(
    "active",
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    customer: Customer | null;
    action: "deactivate" | "activate";
  }>({ open: false, customer: null, action: "deactivate" });
  const [error, setError] = useState<string | null>(null);

  const isActive = isActiveFilter === "active";

  const { data, isLoading } = useCustomerList({ page, search, isActive });
  const deactivateMutation = useDeactivateCustomer();
  const activateMutation = useActivateCustomer();

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
    customer: Customer,
  ): void => {
    event.stopPropagation();
    setConfirmDialog({ open: true, customer, action: "deactivate" });
  };

  const handleActivateClick = (
    event: React.MouseEvent,
    customer: Customer,
  ): void => {
    event.stopPropagation();
    setConfirmDialog({ open: true, customer, action: "activate" });
  };

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

  const columns: ColumnDef<Customer, unknown>[] = [
    {
      accessorKey: "name",
      header: "客戶名稱",
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
        const customer = row.original;
        if (customer.isActive) {
          return (
            <Tooltip title="停用">
              <IconButton
                size="small"
                color="warning"
                onClick={(e) => handleDeactivateClick(e, customer)}
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
              onClick={(e) => handleActivateClick(e, customer)}
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
        <Typography variant="h4">客戶管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate({ to: "/customers/new" })}
        >
          新增客戶
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
          placeholder="搜尋客戶名稱、聯絡人或電話..."
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

      <DataTable<Customer>
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
        onRowClick={(customer) =>
          navigate({
            to: "/customers/$customerId",
            params: { customerId: customer.id },
          })
        }
      />

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
