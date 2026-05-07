import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import type { ProductStatusFilter } from "@/hooks/useProducts";
import {
  useActivateProduct,
  useDeactivateProduct,
  useProductList,
} from "@/hooks/useProducts";
import { useProductThumbnailUrls } from "@/hooks/useProductImages";
import { getRowNumber } from "@/lib/table-utils";
import { client } from "@/lib/amplify-client";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import ImageIcon from "@mui/icons-material/Image";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Product } from "@shared/models";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { ProductToolbar } from "./-components/ProductToolbar";

export const Route = createFileRoute("/products/")({
  beforeLoad: requireAuth,
  component: ProductListPage,
});

const columnHelper = createColumnHelper<Product>();

function ProductListPage(): React.ReactElement {
  const navigate = useNavigate();
  const pagination = useCursorPagination(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    product: Product | null;
    action: "deactivate" | "activate";
  }>({ open: false, product: null, action: "deactivate" });
  const [error, setError] = useState<string | null>(null);

  const isActive =
    statusFilter === "all" ? undefined : statusFilter === "active";

  const { data, isLoading } = useProductList({
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
    search: search || undefined,
    isActive,
  });

  const products = useMemo(() => data?.items ?? [], [data?.items]);
  const nextToken = data?.nextToken;

  // 取得第一張縮圖的預簽名 URL
  const firstImageKeys = useMemo(
    () =>
      products.map((p) => p.imageUrls[0]).filter((key): key is string => !!key),
    [products],
  );
  const { data: thumbnailUrls } = useProductThumbnailUrls(firstImageKeys);

  // 建立 imageKey → thumbnailUrl 的對應表
  const thumbnailMap = useMemo(() => {
    const map = new Map<string, string>();
    if (thumbnailUrls) {
      firstImageKeys.forEach((key, index) => {
        const url = thumbnailUrls[index];
        if (url) map.set(key, url);
      });
    }
    return map;
  }, [firstImageKeys, thumbnailUrls]);

  // 批次查詢供應商名稱
  const supplierIds = useMemo(
    () => [
      ...new Set(
        products
          .map((p) => p.defaultSupplierId)
          .filter((id): id is string => !!id),
      ),
    ],
    [products],
  );

  const { data: supplierMap } = useQuery({
    queryKey: ["suppliers", "names", supplierIds],
    queryFn: async (): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      if (supplierIds.length === 0) return map;

      const results = await Promise.all(
        supplierIds.map(async (id) => {
          const { data: supplier } = await client.models.Supplier.get(
            { id },
            { selectionSet: ["id", "name"] },
          );
          return { id, name: String(supplier?.name ?? "") };
        }),
      );

      for (const { id, name } of results) {
        if (name) map.set(id, name);
      }
      return map;
    },
    enabled: supplierIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 分鐘快取
  });

  const deactivateMutation = useDeactivateProduct();
  const activateMutation = useActivateProduct();

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
    products.length > 0 && selectedIds.size === products.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < products.length;

  const handleSelectAll = useCallback((): void => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((product) => product.id)));
    }
  }, [allSelected, products]);

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

  const handleView = useCallback(
    (product: Product): void => {
      void navigate({
        to: "/products/$productId",
        params: { productId: product.id },
      });
    },
    [navigate],
  );

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

  const handleToggleActive = useCallback((product: Product): void => {
    setConfirmDialog({
      open: true,
      product,
      action: product.isActive ? "deactivate" : "activate",
    });
  }, []);

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
        id: "rowNumber",
        header: "#",
        cell: ({ row }) =>
          getRowNumber(
            pagination.tokenStack.length,
            pagination.pageSize,
            row.index,
          ),
        enableSorting: false,
      }),
      columnHelper.display({
        id: "thumbnail",
        header: "圖片",
        cell: ({ row }) => {
          const firstKey = row.original.imageUrls[0];
          const url = firstKey ? thumbnailMap.get(firstKey) : undefined;
          return (
            <Avatar variant="rounded" src={url} sx={{ width: 40, height: 40 }}>
              {!url && <ImageIcon fontSize="small" />}
            </Avatar>
          );
        },
        enableSorting: false,
      }),
      columnHelper.accessor("name", {
        header: "商品名稱",
        cell: ({ row }) => (
          <Box>
            <Typography sx={{ fontWeight: 600 }}>
              {row.original.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {row.original.sku}
            </Typography>
          </Box>
        ),
      }),
      columnHelper.accessor("unitPrice", {
        header: "單價",
        cell: ({ getValue }) => `$${getValue<number>()}`,
      }),
      columnHelper.accessor("defaultCost", {
        header: "進貨成本",
        cell: ({ getValue }) => `$${getValue<number>()}`,
      }),
      columnHelper.display({
        id: "stock",
        header: "庫存",
        cell: ({ row }) => {
          const product = row.original;
          if (product.variants.length > 0) {
            const totalStock = product.variants.reduce(
              (sum, variant) => sum + variant.stockQuantity,
              0,
            );
            return `${totalStock}（${product.variants.length} 規格）`;
          }
          return product.stockQuantity;
        },
      }),
      columnHelper.display({
        id: "supplier",
        header: "供應商",
        cell: ({ row }) => {
          const supplierId = row.original.defaultSupplierId;
          if (!supplierId)
            return (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            );
          const name = supplierMap?.get(supplierId);
          return <Typography variant="body2">{name ?? "—"}</Typography>;
        },
      }),
      columnHelper.accessor("createdAt", {
        header: "建立日期",
        cell: ({ getValue }) => {
          const value = getValue<string>();
          if (!value) return "—";
          return new Date(value).toLocaleDateString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
        },
      }),
      columnHelper.display({
        id: "status",
        header: "狀態",
        cell: ({ row }) => (
          <Typography
            variant="body2"
            sx={{
              color: row.original.isActive ? "success.main" : "error.main",
              fontWeight: 500,
            }}
          >
            {row.original.isActive ? "啟用中" : "已停用"}
          </Typography>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "操作",
        cell: ({ row }) => {
          const product = row.original;
          return (
            <Box sx={{ display: "flex", gap: 1 }}>
              <Tooltip title="編輯">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEdit(product);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {product.isActive ? (
                <Tooltip title="停用">
                  <IconButton
                    size="small"
                    color="warning"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleActive(product);
                    }}
                  >
                    <BlockIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="啟用">
                  <IconButton
                    size="small"
                    color="success"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleActive(product);
                    }}
                  >
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        },
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
      pagination.tokenStack.length,
      pagination.pageSize,
      thumbnailMap,
      supplierMap,
    ],
  );

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
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
                      目前沒有符合條件的商品資料
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    selected={selectedIds.has(row.original.id)}
                    hover
                    onClick={() => handleView(row.original)}
                    sx={{ cursor: "pointer" }}
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

      <CursorPagination
        pageSize={pagination.pageSize}
        onPageSizeChange={handlePageSizeChange}
        hasNextPage={!!nextToken}
        hasPrevPage={pagination.tokenStack.length > 0}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        currentCount={products.length}
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
