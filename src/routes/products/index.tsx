import { CursorPagination } from "@/components/CursorPagination";
import {
  EditableAutocompleteCell,
  EditableNumberCell,
  EditableStatusCell,
  EditableTextCell,
} from "@/components/EditableCell";
import { listTableBodyTextSx } from "@/components/listTableStyles";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { useProductThumbnailUrls } from "@/hooks/useProductImages";
import type { ProductStatusFilter } from "@/hooks/useProducts";
import {
  useProduct,
  useProductList,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import { requireAuth } from "@/lib/route-guards";
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
import type { Product, UpdateProductInput } from "@shared/models";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { ProductToolbar } from "./-components/ProductToolbar";

export const Route = createFileRoute("/products/")({
  beforeLoad: requireAuth,
  component: ProductListPage,
});

type EditableProductField =
  | "name"
  | "unitPrice"
  | "defaultCost"
  | "stockQuantity"
  | "defaultSupplierId"
  | "isActive";

interface SupplierOption {
  id: string;
  name: string;
}

function ProductListPage(): React.ReactElement {
  const navigate = useNavigate();
  const pagination = useCursorPagination(10);
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
        filter.or = [
          { name: { contains: query } },
          { contactPerson: { contains: query } },
        ];
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
                <TableCell>圖片</TableCell>
                <TableCell>商品名稱</TableCell>
                <TableCell align="right">單價</TableCell>
                <TableCell align="right">庫存數量</TableCell>
                <TableCell align="center">供應商</TableCell>
                <TableCell align="right">進貨成本</TableCell>
                <TableCell>建立日期</TableCell>
                <TableCell align="center">狀態</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {productIds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    align="center"
                    sx={{ py: 4 }}
                  >
                    <Typography color="text.secondary">
                      目前沒有符合條件的商品資料
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                productIds.map((productId) => (
                  <ProductTableRow
                    key={productId}
                    productId={productId}
                    selected={selectedIds.has(productId)}
                    statusDisabled={updateMutation.isPending}
                    searchSuppliers={searchSuppliers}
                    onSelect={handleSelectRow}
                    onEdit={handleEdit}
                    onCellEdit={handleCellEdit}
                  />
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
        currentCount={productIds.length}
      />
    </Box>
  );
}

interface ProductTableRowProps {
  productId: string;
  selected: boolean;
  statusDisabled: boolean;
  searchSuppliers: (query: string) => Promise<SupplierOption[]>;
  onSelect: (productId: string) => void;
  onEdit: (product: Product) => void;
  onCellEdit: (
    product: Product,
    field: EditableProductField,
    value: string | number | boolean | null,
  ) => Promise<void>;
}

function ProductTableRow({
  productId,
  selected,
  statusDisabled,
  searchSuppliers,
  onSelect,
  onEdit,
  onCellEdit,
}: ProductTableRowProps): React.ReactElement {
  const { data: product, isLoading, error } = useProduct(productId);
  const firstImageKey = product?.imageUrls[0];
  const imageKeys = useMemo(
    () => (firstImageKey ? [firstImageKey] : []),
    [firstImageKey],
  );
  const { data: thumbnailUrls } = useProductThumbnailUrls(imageKeys);
  const thumbnailUrl = thumbnailUrls?.[0];
  const supplierId = product?.defaultSupplierId;

  const { data: supplierName } = useQuery({
    queryKey: ["suppliers", "name", supplierId],
    queryFn: async (): Promise<string> => {
      if (!supplierId) return "";

      const { data: supplier } = await client.models.Supplier.get(
        { id: supplierId },
        { selectionSet: ["id", "name"] },
      );
      return String(supplier?.name ?? "");
    },
    enabled: !!supplierId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(productId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={9}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography color="text.secondary">載入商品資料中...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  if (error || !product) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(productId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={9}>
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢商品失敗"}
          </Alert>
        </TableCell>
      </TableRow>
    );
  }

  const createdDate = product.createdAt
    ? new Date(product.createdAt).toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

  const totalStock = product.variants.reduce(
    (sum, variant) => sum + variant.stockQuantity,
    0,
  );

  return (
    <TableRow selected={selected} hover>
      <TableCell>
        <Checkbox
          checked={selected}
          onChange={() => onSelect(product.id)}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Avatar
          variant="rounded"
          src={thumbnailUrl}
          sx={{ width: 40, height: 40 }}
        >
          {!thumbnailUrl && <ImageIcon fontSize="small" />}
        </Avatar>
      </TableCell>
      <TableCell>
        <Box>
          <EditableTextCell
            value={product.name}
            onCommit={(value) => onCellEdit(product, "name", value)}
          />
          <Typography variant="body2" color="text.secondary">
            {product.sku}
          </Typography>
        </Box>
      </TableCell>
      <TableCell align="right">
        <EditableNumberCell
          value={product.unitPrice}
          format={(value) => `$${value}`}
          integer
          align="right"
          onCommit={(value) => onCellEdit(product, "unitPrice", value)}
        />
      </TableCell>
      <TableCell align="right">
        {product.variants.length > 0 ? (
          <EditableNumberCell
            value={totalStock}
            format={(value) => `${value}（${product.variants.length} 規格）`}
            disabled
            disabledText="有規格商品請到編輯頁調整各規格庫存"
            align="right"
            onCommit={async () => undefined}
          />
        ) : (
          <EditableNumberCell
            value={product.stockQuantity}
            integer
            align="right"
            onCommit={(value) => onCellEdit(product, "stockQuantity", value)}
          />
        )}
      </TableCell>
      <TableCell align="center">
        <EditableAutocompleteCell<SupplierOption>
          valueId={supplierId ?? null}
          valueLabel={supplierId ? supplierName : undefined}
          placeholder="搜尋供應商"
          noOptionsText="無符合供應商"
          searchOptions={searchSuppliers}
          onCommit={(value) => onCellEdit(product, "defaultSupplierId", value)}
        />
      </TableCell>
      <TableCell align="right">
        <EditableNumberCell
          value={product.defaultCost}
          format={(value) => `$${value}`}
          integer
          align="right"
          onCommit={(value) => onCellEdit(product, "defaultCost", value)}
        />
      </TableCell>
      <TableCell>{createdDate}</TableCell>
      <TableCell align="center">
        <EditableStatusCell
          isActive={product.isActive}
          disabled={statusDisabled}
          onCommit={(isActive) => onCellEdit(product, "isActive", isActive)}
        />
      </TableCell>
      <TableCell align="center">
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
          <Tooltip title="編輯">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(product);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );
}
