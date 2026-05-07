import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { useProductThumbnailUrls } from "@/hooks/useProductImages";
import type { ProductStatusFilter } from "@/hooks/useProducts";
import {
  useActivateProduct,
  useDeactivateProduct,
  useProductList,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import { requireAuth } from "@/lib/route-guards";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import ImageIcon from "@mui/icons-material/Image";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Product, UpdateProductInput } from "@shared/models";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductToolbar } from "./-components/ProductToolbar";

export const Route = createFileRoute("/products/")({
  beforeLoad: requireAuth,
  component: ProductListPage,
});

const columnHelper = createColumnHelper<Product>();

type EditableProductField =
  | "name"
  | "unitPrice"
  | "defaultCost"
  | "stockQuantity"
  | "defaultSupplierId";

interface SupplierOption {
  id: string;
  name: string;
}

interface EditableTextCellProps {
  value: string;
  onCommit: (value: string) => Promise<void>;
}

function EditableTextCell({
  value,
  onCommit,
}: EditableTextCellProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const commit = async (): Promise<void> => {
    const nextValue = draft.trim();
    if (nextValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onCommit(nextValue);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <TextField
        value={draft}
        size="small"
        variant="outlined"
        autoFocus
        fullWidth
        disabled={isSaving}
        helperText={isSaving ? "保存中" : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraft(value);
            setIsEditing(false);
          }
        }}
        slotProps={{
          input: {
            endAdornment: isSaving ? (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
    );
  }

  return (
    <Typography
      role="button"
      tabIndex={0}
      sx={{ cursor: "text", fontWeight: 600 }}
      onClick={(event) => {
        event.stopPropagation();
        setDraft(value);
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setDraft(value);
          setIsEditing(true);
        }
      }}
    >
      {value}
    </Typography>
  );
}

interface EditableNumberCellProps {
  value: number;
  format?: (value: number) => string;
  integer?: boolean;
  disabled?: boolean;
  disabledText?: string;
  onCommit: (value: number) => Promise<void>;
}

interface EditableStatusCellProps {
  isActive: boolean;
  disabled?: boolean;
  onCommit: (isActive: boolean) => Promise<void>;
}

function EditableStatusCell({
  isActive,
  disabled = false,
  onCommit,
}: EditableStatusCellProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const commit = async (nextIsActive: boolean): Promise<void> => {
    if (nextIsActive === isActive) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onCommit(nextIsActive);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Box>
        <Select
          value={isActive ? "active" : "inactive"}
          size="small"
          variant="outlined"
          autoFocus
          open
          disabled={disabled || isSaving}
          sx={{
            minWidth: 88,
            color: isActive ? "success.main" : "error.main",
            "& .MuiSelect-select": {
              fontWeight: 500,
            },
          }}
          onClick={(event) => event.stopPropagation()}
          onClose={() => setIsEditing(false)}
          onChange={(event) => {
            void commit(event.target.value === "active");
          }}
        >
          <MenuItem value="active">啟用中</MenuItem>
          <MenuItem value="inactive">已停用</MenuItem>
        </Select>
        {isSaving && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            保存中
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Typography
      role="button"
      tabIndex={0}
      variant="body2"
      sx={{
        color: isActive ? "success.main" : "error.main",
        cursor: disabled ? "default" : "text",
        fontWeight: 500,
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !disabled) {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {isActive ? "啟用中" : "已停用"}
    </Typography>
  );
}

interface EditableSupplierCellProps {
  supplierId: string | null;
  supplierName?: string;
  searchSuppliers: (query: string) => Promise<SupplierOption[]>;
  onCommit: (supplierId: string | null) => Promise<void>;
}

function EditableSupplierCell({
  supplierId,
  supplierName,
  searchSuppliers,
  onCommit,
}: EditableSupplierCellProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [value, setValue] = useState<SupplierOption | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;

    let active = true;
    setIsLoading(true);
    void searchSuppliers(inputValue)
      .then((results) => {
        if (!active) return;
        setOptions(results);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [inputValue, isEditing, searchSuppliers]);

  const currentSupplier = supplierId
    ? { id: supplierId, name: supplierName ?? "未命名供應商" }
    : null;

  const openEditor = (): void => {
    setValue(currentSupplier);
    setInputValue("");
    setIsEditing(true);
  };

  const commit = async (nextValue: SupplierOption | null): Promise<void> => {
    const nextSupplierId = nextValue?.id ?? null;
    if (nextSupplierId === supplierId) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onCommit(nextSupplierId);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Autocomplete
        open
        size="small"
        value={value}
        options={options}
        inputValue={inputValue}
        loading={isLoading}
        disabled={isSaving}
        clearOnBlur={false}
        isOptionEqualToValue={(option, selected) => option.id === selected.id}
        getOptionLabel={(option) => option.name}
        noOptionsText="無符合供應商"
        loadingText="載入中..."
        onChange={(_event, nextValue) => {
          setValue(nextValue);
          void commit(nextValue);
        }}
        onClose={() => setIsEditing(false)}
        onInputChange={(_event, nextInputValue) => {
          setInputValue(nextInputValue);
        }}
        renderInput={(params) => {
          const { slotProps: paramSlotProps, ...restParams } = params;
          return (
            <TextField
              {...restParams}
              autoFocus
              variant="outlined"
              placeholder="搜尋供應商"
              helperText={isSaving ? "保存中" : undefined}
              onClick={(event) => event.stopPropagation()}
              slotProps={{
                ...paramSlotProps,
                input: {
                  ...paramSlotProps?.input,
                  endAdornment: (
                    <>
                      {isLoading || isSaving ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : null}
                      {paramSlotProps?.input?.endAdornment}
                    </>
                  ),
                },
              }}
            />
          );
        }}
        sx={{ minWidth: 180 }}
      />
    );
  }

  return (
    <Typography
      role="button"
      tabIndex={0}
      variant="body2"
      color={supplierId ? "text.primary" : "text.secondary"}
      sx={{ cursor: "text" }}
      onClick={(event) => {
        event.stopPropagation();
        openEditor();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          openEditor();
        }
      }}
    >
      {supplierName ?? "—"}
    </Typography>
  );
}

function EditableNumberCell({
  value,
  format = (nextValue) => String(nextValue),
  integer = false,
  disabled = false,
  disabledText,
  onCommit,
}: EditableNumberCellProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [isSaving, setIsSaving] = useState(false);

  const commit = async (): Promise<void> => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      setIsEditing(false);
      return;
    }

    const nextValue = integer ? Math.trunc(parsed) : parsed;
    if (nextValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onCommit(nextValue);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (disabled) {
    return (
      <Tooltip title={disabledText ?? ""}>
        <Typography component="span">{format(value)}</Typography>
      </Tooltip>
    );
  }

  if (isEditing) {
    return (
      <TextField
        value={draft}
        size="small"
        variant="outlined"
        type="number"
        autoFocus
        disabled={isSaving}
        helperText={isSaving ? "保存中" : undefined}
        slotProps={{
          htmlInput: { min: 0, step: integer ? 1 : 0.01 },
          input: {
            endAdornment: isSaving ? (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ) : undefined,
          },
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraft(String(value));
            setIsEditing(false);
          }
        }}
        sx={{ width: 96 }}
      />
    );
  }

  return (
    <Typography
      role="button"
      tabIndex={0}
      sx={{ cursor: "text" }}
      onClick={(event) => {
        event.stopPropagation();
        setDraft(String(value));
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setDraft(String(value));
          setIsEditing(true);
        }
      }}
    >
      {format(value)}
    </Typography>
  );
}

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

  const deactivateMutation = useDeactivateProduct();
  const activateMutation = useActivateProduct();
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

  const handleCellEdit = useCallback(
    async (
      product: Product,
      field: EditableProductField,
      value: string | number | null,
    ): Promise<void> => {
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

  const handleStatusEdit = useCallback(
    async (product: Product, isActive: boolean): Promise<void> => {
      if (product.isActive === isActive) return;

      setError(null);
      try {
        if (isActive) {
          await activateMutation.mutateAsync({ productId: product.id });
        } else {
          await deactivateMutation.mutateAsync({ productId: product.id });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新商品狀態失敗");
      }
    },
    [activateMutation, deactivateMutation],
  );

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
            <EditableTextCell
              value={row.original.name}
              onCommit={(value) => handleCellEdit(row.original, "name", value)}
            />
            <Typography variant="body2" color="text.secondary">
              {row.original.sku}
            </Typography>
          </Box>
        ),
      }),
      columnHelper.accessor("unitPrice", {
        header: "單價",
        cell: ({ row, getValue }) => (
          <EditableNumberCell
            value={getValue<number>()}
            format={(value) => `$${value}`}
            integer
            onCommit={(value) =>
              handleCellEdit(row.original, "unitPrice", value)
            }
          />
        ),
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
            return (
              <EditableNumberCell
                value={totalStock}
                format={(value) =>
                  `${value}（${product.variants.length} 規格）`
                }
                disabled
                disabledText="有規格商品請到編輯頁調整各規格庫存"
                onCommit={async () => undefined}
              />
            );
          }
          return (
            <EditableNumberCell
              value={product.stockQuantity}
              integer
              onCommit={(value) =>
                handleCellEdit(product, "stockQuantity", value)
              }
            />
          );
        },
      }),
      columnHelper.display({
        id: "supplier",
        header: "供應商",
        cell: ({ row }) => {
          const supplierId = row.original.defaultSupplierId;
          return (
            <EditableSupplierCell
              supplierId={supplierId}
              supplierName={
                supplierId ? supplierMap?.get(supplierId) : undefined
              }
              searchSuppliers={searchSuppliers}
              onCommit={(value) =>
                handleCellEdit(row.original, "defaultSupplierId", value)
              }
            />
          );
        },
      }),
      columnHelper.accessor("defaultCost", {
        header: "進貨成本",
        cell: ({ row, getValue }) => (
          <EditableNumberCell
            value={getValue<number>()}
            format={(value) => `$${value}`}
            integer
            onCommit={(value) =>
              handleCellEdit(row.original, "defaultCost", value)
            }
          />
        ),
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
      handleCellEdit,
      handleStatusEdit,
      searchSuppliers,
      activateMutation.isPending,
      deactivateMutation.isPending,
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
