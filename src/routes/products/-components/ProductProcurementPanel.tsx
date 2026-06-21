import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CursorPagination } from "@/components/CursorPagination";
import { StatusChip } from "@/components/StatusChip";
import {
  useAddOrderItemToOrder,
  useDeleteOrderItemFromOrder,
  useProductOrderItemList,
  useUpdateOrderItemInOrder,
  useUpdateOrderItemStatusFlag,
  type ProductOrderItemRecord,
} from "@/hooks/useOrders";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { formatCurrency } from "@/lib/currency";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Product } from "@shared/models";
import { ORDER_ITEM_STATUS_LABEL } from "@shared/models";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ORDER_ITEM_STATUS_COLOR_MAP,
  ORDER_STATUS_COLOR_MAP,
  ORDER_STATUS_LABEL,
} from "../../orders/-components/detail/detailUtils";
import {
  ProductPurchaseItemDialog,
  type ProductPurchaseItemEditData,
  type ProductPurchaseItemSubmitInput,
} from "../../product-purchases/-components/ProductPurchaseItemDialog";

const PAGE_SIZE = 10;

function formatDate(value: string | null): string {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function canToggleOrdered(record: ProductOrderItemRecord): boolean {
  return record.item.status === "PENDING" || record.item.status === "ORDERED";
}

function canEditRecord(record: ProductOrderItemRecord): boolean {
  return (
    (record.orderStatus === "PENDING" || record.orderStatus === "ORDERED") &&
    (record.item.status === "PENDING" || record.item.status === "ORDERED")
  );
}

function toEditData(
  record: ProductOrderItemRecord | null,
): ProductPurchaseItemEditData | null {
  if (!record) return null;

  const variantLabel =
    record.item.selectedOptionsSnapshot
      ?.map((opt) => opt.valueName)
      .join(" / ") || null;

  return {
    orderId: record.orderId,
    quantity: record.item.quantity,
    unitPrice: record.item.unitPriceSnapshot,
    unitCost: record.item.unitCostSnapshot,
    supplierName: record.item.supplierName,
    selectedOptionsSnapshot: record.item.selectedOptionsSnapshot,
    variantLabel,
  };
}

export interface ProductProcurementPanelProps {
  product: Product;
}

export function ProductProcurementPanel({
  product,
}: ProductProcurementPanelProps): React.ReactElement {
  const {
    currentToken,
    pageSize,
    tokenStack,
    goNext,
    goPrev,
    setPageSize,
    reset,
  } = useCursorPagination(PAGE_SIZE);
  const { data, isLoading, error } = useProductOrderItemList({
    productId: product.id,
    pageSize,
    nextToken: currentToken,
    statuses: ["PENDING", "ORDERED"],
  });
  const addOrderItem = useAddOrderItemToOrder();
  const updateOrderItem = useUpdateOrderItemInOrder();
  const deleteOrderItem = useDeleteOrderItemFromOrder();
  const updateStatusFlag = useUpdateOrderItemStatusFlag();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductOrderItemRecord | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<ProductOrderItemRecord | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    reset();
  }, [product.id, reset]);

  const records = useMemo(() => data?.items ?? [], [data?.items]);
  const editData = useMemo(() => toEditData(editTarget), [editTarget]);
  const summary = useMemo(
    () =>
      records.reduce(
        (acc, record) => {
          if (record.item.status === "PENDING") acc.pending += 1;
          if (record.item.status === "ORDERED") acc.ordered += 1;
          return acc;
        },
        { pending: 0, ordered: 0 },
      ),
    [records],
  );

  const handleDialogClose = useCallback((): void => {
    setDialogOpen(false);
    setEditTarget(null);
  }, []);

  const handleStartCreate = useCallback((): void => {
    setPanelError(null);
    setEditTarget(null);
    setDialogOpen(true);
  }, []);

  const handleStartEdit = useCallback((record: ProductOrderItemRecord): void => {
    setPanelError(null);
    setEditTarget(record);
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(async (
    input: ProductPurchaseItemSubmitInput,
  ): Promise<void> => {
    setPanelError(null);

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
      setPanelError(err instanceof Error ? err.message : "儲存訂貨資料失敗");
      throw err;
    }
  }, [addOrderItem, editTarget, handleDialogClose, product, updateOrderItem]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return;

    setPanelError(null);
    try {
      await deleteOrderItem.mutateAsync({
        orderId: deleteTarget.orderId,
        orderItemId: deleteTarget.item.id,
      });
      setDeleteTarget(null);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "刪除訂貨資料失敗");
      setDeleteTarget(null);
    }
  }, [deleteOrderItem, deleteTarget]);

  return (
    <>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                訂貨管理
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                依產品查看「{product.name}」的待訂貨與已訂貨作業，直接完成訂貨管理。
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleStartCreate}
            >
              新增作業
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Alert severity="info" sx={{ py: 0 }}>
              待訂貨 {summary.pending} 筆
            </Alert>
            <Alert severity="warning" sx={{ py: 0 }}>
              已訂貨 {summary.ordered} 筆
            </Alert>
          </Stack>

          {panelError ? (
            <Alert severity="error" onClose={() => setPanelError(null)}>
              {panelError}
            </Alert>
          ) : null}

          {error ? (
            <Alert severity="error">
              {error instanceof Error ? error.message : "查詢訂貨資料失敗"}
            </Alert>
          ) : null}

          {isLoading ? (
            <Paper
              variant="outlined"
              sx={{ display: "flex", justifyContent: "center", py: 6 }}
            >
              <CircularProgress />
            </Paper>
          ) : records.length === 0 ? (
            <Paper variant="outlined" sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary">
                目前沒有屬於「{product.name}」的待訂貨或已訂貨作業
              </Typography>
            </Paper>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table sx={{ minWidth: 1180 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>訂單編號</TableCell>
                      <TableCell>客戶</TableCell>
                      <TableCell>規格</TableCell>
                      <TableCell align="right">數量</TableCell>
                      <TableCell align="right">單價</TableCell>
                      <TableCell align="right">採購成本</TableCell>
                      <TableCell>供應商</TableCell>
                      <TableCell align="center">明細狀態</TableCell>
                      <TableCell align="center">訂單狀態</TableCell>
                      <TableCell align="center">訂貨日期</TableCell>
                      <TableCell align="center">快捷操作</TableCell>
                      <TableCell align="center">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((record) => {
                      const canEdit = canEditRecord(record);
                      return (
                        <TableRow key={record.item.id} hover>
                          <TableCell>{record.orderNumber}</TableCell>
                          <TableCell>{record.customerName}</TableCell>
                          <TableCell>{record.item.selectedOptionsSnapshot?.map((opt) => opt.valueName).join(" / ") || "-"}</TableCell>
                          <TableCell align="right">
                            {record.item.quantity}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(record.item.unitPriceSnapshot)}
                          </TableCell>
                          <TableCell align="right">
                            {record.item.unitCostSnapshot != null
                              ? formatCurrency(record.item.unitCostSnapshot)
                              : "-"}
                          </TableCell>
                          <TableCell>{record.item.supplierName || "-"}</TableCell>
                          <TableCell align="center">
                            <StatusChip
                              status={record.item.status}
                              label={ORDER_ITEM_STATUS_LABEL[record.item.status]}
                              colorMap={ORDER_ITEM_STATUS_COLOR_MAP}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <StatusChip
                              status={record.orderStatus}
                              label={ORDER_STATUS_LABEL[record.orderStatus]}
                              colorMap={ORDER_STATUS_COLOR_MAP}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {formatDate(record.item.purchasedAt)}
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant={
                                record.item.purchasedAt ? "contained" : "outlined"
                              }
                              color="warning"
                              disabled={
                                !canToggleOrdered(record) ||
                                updateStatusFlag.isPending
                              }
                              onClick={() =>
                                updateStatusFlag.mutate({
                                  orderId: record.orderId,
                                  orderItemId: record.item.id,
                                  flag: "ordered",
                                  checked: !record.item.purchasedAt,
                                })
                              }
                            >
                              {record.item.purchasedAt ? "取消訂貨" : "確認訂貨"}
                            </Button>
                          </TableCell>
                          <TableCell align="center">
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "center",
                                gap: 1,
                              }}
                            >
                              <Tooltip title="編輯">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={!canEdit}
                                    onClick={() => handleStartEdit(record)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="刪除">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={!canEdit}
                                    onClick={() => setDeleteTarget(record)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <CursorPagination
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                hasNextPage={!!data?.nextToken}
                hasPrevPage={tokenStack.length > 0}
                onNextPage={() => {
                  if (data?.nextToken) goNext(data.nextToken);
                }}
                onPrevPage={goPrev}
                currentCount={records.length}
              />
            </>
          )}
        </Stack>
      </Paper>

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
        title="刪除訂貨作業"
        message={`確定要刪除訂單「${deleteTarget?.orderNumber ?? ""}」中的這筆訂貨作業嗎？此操作無法復原。`}
        confirmLabel="確認刪除"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
