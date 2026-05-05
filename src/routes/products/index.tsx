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
  useProductList,
  useDeactivateProduct,
  useActivateProduct,
} from "@/hooks/useProducts";
import type { Product } from "@shared/models";

export const Route = createFileRoute("/products/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: ProductListPage,
});

function ProductListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"active" | "inactive">(
    "active",
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    product: Product | null;
    action: "deactivate" | "activate";
  }>({ open: false, product: null, action: "deactivate" });
  const [error, setError] = useState<string | null>(null);

  const isActive = isActiveFilter === "active";

  const { data, isLoading } = useProductList({ page, search, isActive });
  const deactivateMutation = useDeactivateProduct();
  const activateMutation = useActivateProduct();

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
    product: Product,
  ): void => {
    event.stopPropagation();
    setConfirmDialog({ open: true, product, action: "deactivate" });
  };

  const handleActivateClick = (
    event: React.MouseEvent,
    product: Product,
  ): void => {
    event.stopPropagation();
    setConfirmDialog({ open: true, product, action: "activate" });
  };

  const handleConfirm = async (): Promise<void> => {
    const { product, action } = confirmDialog;
    if (!product) return;

    setError(null);
    try {
      if (action === "deactivate") {
        await deactivateMutation.mutateAsync({ productId: product.id });
      } else {
        await activateMutation.mutateAsync({ productId: product.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setConfirmDialog({ open: false, product: null, action: "deactivate" });
    }
  };

  const handleCancel = (): void => {
    setConfirmDialog({ open: false, product: null, action: "deactivate" });
  };

  const columns: ColumnDef<Product, unknown>[] = [
    {
      accessorKey: "name",
      header: "商品名稱",
    },
    {
      accessorKey: "sku",
      header: "SKU",
    },
    {
      accessorKey: "unitPrice",
      header: "單價",
      cell: ({ getValue }) => `$${getValue<number>()}`,
    },
    {
      accessorKey: "defaultCost",
      header: "進貨成本",
      cell: ({ getValue }) => `$${getValue<number>()}`,
    },
    {
      accessorKey: "stockQuantity",
      header: "庫存數量",
      cell: ({ row }) => {
        const product = row.original;
        if (product.variants.length > 0) {
          const totalStock = product.variants.reduce(
            (sum, v) => sum + v.stockQuantity,
            0,
          );
          return `${totalStock}（${product.variants.length} 規格）`;
        }
        return product.stockQuantity;
      },
    },
    {
      id: "actions",
      header: "操作",
      enableSorting: false,
      cell: ({ row }) => {
        const product = row.original;
        if (product.isActive) {
          return (
            <Tooltip title="停用">
              <IconButton
                size="small"
                color="warning"
                onClick={(e) => handleDeactivateClick(e, product)}
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
              onClick={(e) => handleActivateClick(e, product)}
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
        <Typography variant="h4">商品管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate({ to: "/products/new" })}
        >
          新增商品
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
          placeholder="搜尋商品名稱或 SKU..."
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

      <DataTable<Product>
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
        onRowClick={(product) =>
          navigate({
            to: "/products/$productId",
            params: { productId: product.id },
          })
        }
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.action === "deactivate" ? "停用商品" : "啟用商品"}
        message={
          confirmDialog.action === "deactivate"
            ? `確定要停用商品「${confirmDialog.product?.name ?? ""}」嗎？停用後將不會出現在訂單建立的商品選取清單中。`
            : `確定要重新啟用商品「${confirmDialog.product?.name ?? ""}」嗎？`
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
