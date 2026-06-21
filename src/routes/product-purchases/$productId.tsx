import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CursorPagination } from "@/components/CursorPagination";
import { ListToolbar, type ListToolbarOption } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import {
  useAddOrderItemToOrder,
  useAllProductOrderItems,
  useDeleteOrderItemFromOrder,
  useUpdateOrderItemInOrder,
  type ProductOrderItemRecord,
} from "@/hooks/useOrders";
import { useProduct } from "@/hooks/useProducts";
import { requireAuth } from "@/lib/route-guards";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import {
  ORDER_ITEM_STATUSES,
  type OrderFulfillmentStatus,
} from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  ProductPurchaseItemDialog,
  type ProductPurchaseItemEditData,
  type ProductPurchaseItemSubmitInput,
} from "./-components/ProductPurchaseItemDialog";
import { ProductPurchaseItemTable } from "./-components/ProductPurchaseItemTable";

type ProductPurchaseDetailStatusFilter = "all" | OrderFulfillmentStatus;

const STATUS_OPTIONS: readonly ListToolbarOption<ProductPurchaseDetailStatusFilter>[] = [
  { value: "all", label: "全部狀態" },
  { value: "PENDING", label: "待處理" },
  { value: "ORDERED", label: "已採購" },
  { value: "RECEIVED", label: "已到貨" },
  { value: "SHIPPED", label: "已出貨" },
  { value: "OUT_OF_STOCK", label: "缺貨" },
];

const ORDER_ITEM_STATUS_SORT_INDEX = new Map(
  ORDER_ITEM_STATUSES.map((status, index) => [status, index] as const),
);

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

export const Route = createFileRoute("/product-purchases/$productId")({
  beforeLoad: requireAuth,
  component: ProductPurchaseDetailPage,
});

function ProductPurchaseDetailPage(): React.ReactElement {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const { data: product, isLoading: isLoadingProduct, error: productError } =
    useProduct(productId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ProductPurchaseDetailStatusFilter>("all");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const {
    data: records,
    isLoading: isLoadingRecords,
    error: recordsError,
  } = useAllProductOrderItems({
    productId,
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
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDialogClose = useCallback((): void => {
    setDialogOpen(false);
    setEditTarget(null);
  }, []);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return [...(records ?? [])]
      .sort((a, b) => {
        const statusDelta =
          (ORDER_ITEM_STATUS_SORT_INDEX.get(a.item.status) ??
            Number.MAX_SAFE_INTEGER) -
          (ORDER_ITEM_STATUS_SORT_INDEX.get(b.item.status) ??
            Number.MAX_SAFE_INTEGER);

        if (statusDelta !== 0) {
          return statusDelta;
        }

        const timeA = Date.parse(
          a.item.shippedAt ??
            a.item.receivedAt ??
            a.item.purchasedAt ??
            "1970-01-01T00:00:00.000Z",
        );
        const timeB = Date.parse(
          b.item.shippedAt ??
            b.item.receivedAt ??
            b.item.purchasedAt ??
            "1970-01-01T00:00:00.000Z",
        );

        return timeB - timeA;
      })
      .filter((record) => {
        if (!keyword) {
          return true;
        }

        return [
          record.orderNumber,
          record.customerName,
          record.item.selectedOptionsSnapshot?.map((opt) => opt.valueName).join(" / ") ?? "",
          record.item.supplierName ?? "",
        ].some((value) => value.toLowerCase().includes(keyword));
      });
  }, [records, search]);

  const pagedRecords = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, pageIndex, pageSize]);

  const editData = useMemo(() => toEditData(editTarget), [editTarget]);
  const hasPrevPage = pageIndex > 0;
  const hasNextPage = (pageIndex + 1) * pageSize < filteredRecords.length;

  const handleSubmit = useCallback(async (
    input: ProductPurchaseItemSubmitInput,
  ): Promise<void> => {
    if (!product) return;

    setActionError(null);
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
      setActionError(err instanceof Error ? err.message : "儲存作業資料失敗");
      throw err;
    }
  }, [addOrderItem, editTarget, handleDialogClose, product, updateOrderItem]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return;

    setActionError(null);
    try {
      await deleteOrderItem.mutateAsync({
        orderId: deleteTarget.orderId,
        orderItemId: deleteTarget.item.id,
      });
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "刪除作業資料失敗");
      setDeleteTarget(null);
    }
  }, [deleteOrderItem, deleteTarget]);

  if (isLoadingProduct) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (productError || !product) {
    return (
      <Box>
        <Alert severity="error">{productError?.message ?? "找不到該商品"}</Alert>
        <Button
          sx={{ mt: 2 }}
          onClick={() => void navigate({ to: "/product-purchases" })}
        >
          返回單品採購列表
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        section="單品採購"
        current={product.name}
        title="作業明細"
        actions={
          <>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => void navigate({ to: "/product-purchases" })}
            >
              返回
            </Button>
            <Chip label={product.sku} variant="outlined" />
          </>
        }
      />

      <Stack spacing={2}>
        <Alert severity="info">
          目前顯示「{product.name}」的全部 OrderItem 作業明細。
        </Alert>

        {actionError ? (
          <Alert severity="error" onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        ) : null}

        {recordsError ? (
          <Alert severity="error">
            {recordsError instanceof Error
              ? recordsError.message
              : "查詢單品採購明細失敗"}
          </Alert>
        ) : null}

        <ListToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPageIndex(0);
          }}
          totalCount={filteredRecords.length}
          statusSelect={{
            value: statusFilter,
            onChange: (value) => {
              setStatusFilter(value);
              setPageIndex(0);
            },
            options: STATUS_OPTIONS,
            ariaLabel: "單品採購明細狀態篩選",
          }}
          actions={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditTarget(null);
                setDialogOpen(true);
              }}
            >
              新增作業
            </Button>
          }
        />

        {isLoadingRecords ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <ProductPurchaseItemTable
            records={pagedRecords}
            onEdit={(record) => {
              setEditTarget(record);
              setDialogOpen(true);
            }}
            onDelete={setDeleteTarget}
          />
        )}

        <CursorPagination
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageIndex(0);
          }}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onNextPage={() => {
            if (hasNextPage) {
              setPageIndex((current) => current + 1);
            }
          }}
          onPrevPage={() => {
            if (hasPrevPage) {
              setPageIndex((current) => current - 1);
            }
          }}
          currentCount={pagedRecords.length}
        />
      </Stack>

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
    </Box>
  );
}
