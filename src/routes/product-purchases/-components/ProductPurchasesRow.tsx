import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CursorPagination } from "@/components/CursorPagination";
import { listTableBodyTextSx } from "@/components/listTableStyles";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import {
  useAddOrderItemToOrder,
  useDeleteOrderItemFromOrder,
  useProductOrderItemList,
  useUpdateOrderItemInOrder,
  type ProductOrderItemRecord,
} from "@/hooks/useOrders";
import { useProduct } from "@/hooks/useProducts";
import { formatCurrency } from "@/lib/currency";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { Product } from "@shared/models";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ProductPurchaseItemDialog,
  type ProductPurchaseItemEditData,
  type ProductPurchaseItemSubmitInput,
} from "./ProductPurchaseItemDialog";
import { ProductPurchaseItemTable } from "./ProductPurchaseItemTable";
import type { ProductPurchaseStatusFilter } from "./ProductPurchasesToolbar";

export interface ProductPurchasesRowProps {
  productId: string;
  statusFilter: ProductPurchaseStatusFilter;
}

type ProductPurchaseSummary = {
  pending: number;
  ordered: number;
  received: number;
  shipped: number;
  outOfStock: number;
};

const INITIAL_SUMMARY: ProductPurchaseSummary = {
  pending: 0,
  ordered: 0,
  received: 0,
  shipped: 0,
  outOfStock: 0,
};

const ITEM_PAGE_SIZE = 10;

function buildProductPurchaseSummary(
  records: readonly ProductOrderItemRecord[],
): ProductPurchaseSummary {
  return records.reduce<ProductPurchaseSummary>((acc, record) => {
    if (record.item.status === "pending") acc.pending += 1;
    if (record.item.status === "ordered") acc.ordered += 1;
    if (record.item.status === "received") acc.received += 1;
    if (record.item.status === "shipped") acc.shipped += 1;
    if (record.item.status === "out_of_stock") acc.outOfStock += 1;
    return acc;
  }, { ...INITIAL_SUMMARY });
}

function toEditData(
  record: ProductOrderItemRecord | null,
): ProductPurchaseItemEditData | null {
  if (!record) return null;

  return {
    orderId: record.orderId,
    quantity: record.item.quantity,
    unitPrice: record.item.unitPrice,
    unitCost: record.item.unitCost,
    supplierName: record.item.supplierName,
    selectedOptionsSnapshot: record.item.selectedOptionsSnapshot,
    variantLabel: record.item.variantLabel,
  };
}

function ProductPurchaseSummaryRow({
  product,
  summary,
  recordCount,
  onAddClick,
}: {
  product: Product;
  summary: ProductPurchaseSummary;
  recordCount: number;
  onAddClick: () => void;
}): React.ReactElement {
  return (
    <Table
      size="small"
      sx={{
        ...listTableBodyTextSx,
        "& .MuiTableCell-root": {
          borderBottomColor: "divider",
        },
      }}
    >
      <TableBody>
        <TableRow hover>
          <TableCell sx={{ width: 72 }}>#{product.sequenceNumber}</TableCell>
          <TableCell sx={{ width: 320, minWidth: 320 }}>
            <Stack spacing={0.5}>
              <Typography sx={{ fontWeight: 600 }}>{product.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {product.sku}
              </Typography>
            </Stack>
          </TableCell>
          <TableCell align="right" sx={{ width: 96 }}>
            {formatCurrency(product.price)}
          </TableCell>
          <TableCell align="right" sx={{ width: 96 }}>
            {formatCurrency(product.cost)}
          </TableCell>
          <TableCell align="right" sx={{ width: 84 }}>
            {product.stockQuantity}
          </TableCell>
          <TableCell align="center" sx={{ width: 88 }}>
            {recordCount}
          </TableCell>
          <TableCell align="center" sx={{ width: 84 }}>
            {summary.pending}
          </TableCell>
          <TableCell align="center" sx={{ width: 84 }}>
            {summary.ordered}
          </TableCell>
          <TableCell align="center" sx={{ width: 84 }}>
            {summary.received}
          </TableCell>
          <TableCell align="center" sx={{ width: 84 }}>
            {summary.shipped}
          </TableCell>
          <TableCell align="center" sx={{ width: 180 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: "center", flexWrap: "wrap" }}
            >
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAddClick}
              >
                新增作業
              </Button>
            </Stack>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function ProductPurchasesRow({
  productId,
  statusFilter,
}: ProductPurchasesRowProps): React.ReactElement | null {
  const pagination = useCursorPagination(ITEM_PAGE_SIZE);
  const { data: product, isLoading: isLoadingProduct, error: productError } =
    useProduct(productId);
  const {
    data: itemData,
    isLoading: isLoadingItems,
    error: itemError,
  } = useProductOrderItemList({
    productId,
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const addOrderItem = useAddOrderItemToOrder();
  const updateOrderItem = useUpdateOrderItemInOrder();
  const deleteOrderItem = useDeleteOrderItemFromOrder();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductOrderItemRecord | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<ProductOrderItemRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pagination.reset();
  }, [pagination.reset, productId, statusFilter]);

  const records = itemData?.items ?? [];
  const summary = useMemo(() => buildProductPurchaseSummary(records), [records]);
  const editData = useMemo(() => toEditData(editTarget), [editTarget]);

  const handleDialogClose = useCallback((): void => {
    setDialogOpen(false);
    setEditTarget(null);
  }, []);

  const handleStartCreate = useCallback((): void => {
    setEditTarget(null);
    setDialogOpen(true);
  }, []);

  const handleStartEdit = useCallback((record: ProductOrderItemRecord): void => {
    setEditTarget(record);
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(async (
    input: ProductPurchaseItemSubmitInput,
  ): Promise<void> => {
    if (!product) return;

    setError(null);
    try {
      if (editTarget) {
        await updateOrderItem.mutateAsync({
          orderId: editTarget.orderId,
          orderItemId: editTarget.item.id,
          productId: product.id,
          productName: product.name,
          productImageUrl: product.imageUrls[0] ?? null,
          productSku: product.sku,
          variantLabel: input.variantLabel,
          selectedOptionsSnapshot: input.selectedOptionsSnapshot,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          unitCost: input.unitCost,
          supplierName: input.supplierName,
        });
      } else {
        await addOrderItem.mutateAsync({
          orderId: input.orderId,
          productId: product.id,
          productName: product.name,
          productImageUrl: product.imageUrls[0] ?? null,
          productSku: product.sku,
          variantLabel: input.variantLabel,
          selectedOptionsSnapshot: input.selectedOptionsSnapshot,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          unitCost: input.unitCost,
          supplierName: input.supplierName,
        });
      }

      handleDialogClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存作業資料失敗");
      throw err;
    }
  }, [addOrderItem, editTarget, handleDialogClose, product, updateOrderItem]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return;

    setError(null);
    try {
      await deleteOrderItem.mutateAsync({
        orderId: deleteTarget.orderId,
        orderItemId: deleteTarget.item.id,
      });
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除作業資料失敗");
      setDeleteTarget(null);
    }
  }, [deleteOrderItem, deleteTarget]);

  if (isLoadingProduct) {
    return (
      <Paper
        variant="outlined"
        sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5 }}
      >
        <CircularProgress size={16} />
        <Typography color="text.secondary">載入商品資料中...</Typography>
      </Paper>
    );
  }

  if (productError || !product) {
    return (
      <Paper variant="outlined" sx={{ borderColor: "error.light", p: 2 }}>
        <Typography color="error">
          {productError instanceof Error ? productError.message : "查詢商品失敗"}
        </Typography>
      </Paper>
    );
  }

  if (
    statusFilter !== "all" &&
    !isLoadingItems &&
    !itemError &&
    records.length === 0
  ) {
    return null;
  }

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <ProductPurchaseSummaryRow
          product={product}
          summary={summary}
          recordCount={records.length}
          onAddClick={handleStartCreate}
        />

        {error ? (
          <Paper sx={{ mx: 2, mt: 2, p: 2 }} variant="outlined">
            <Typography color="error">{error}</Typography>
          </Paper>
        ) : null}

        {isLoadingItems ? (
          <Paper sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={20} />
          </Paper>
        ) : itemError ? (
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography color="error">
              {itemError instanceof Error ? itemError.message : "查詢作業資料失敗"}
            </Typography>
          </Paper>
        ) : (
          <ProductPurchaseItemTable
            records={records}
            onEdit={handleStartEdit}
            onDelete={setDeleteTarget}
          />
        )}

        <Box sx={{ px: 2, pb: 2 }}>
          <CursorPagination
            pageSize={pagination.pageSize}
            onPageSizeChange={pagination.setPageSize}
            hasNextPage={!!itemData?.nextToken}
            hasPrevPage={pagination.tokenStack.length > 0}
            onNextPage={() => {
              if (itemData?.nextToken) pagination.goNext(itemData.nextToken);
            }}
            onPrevPage={pagination.goPrev}
            currentCount={records.length}
          />
        </Box>
      </TableContainer>

      <ProductPurchaseItemDialog
        open={dialogOpen}
        product={product}
        editData={editData}
        isSubmitting={addOrderItem.isPending || updateOrderItem.isPending}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="刪除作業明細"
        message={`確定要刪除訂單「${deleteTarget?.orderNumber ?? ""}」中的這筆作業明細嗎？此操作無法復原。`}
        confirmLabel="確認刪除"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
