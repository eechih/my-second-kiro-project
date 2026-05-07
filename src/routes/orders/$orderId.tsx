import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { StatusChip } from "@/components/StatusChip";
import {
  useConfirmReceived,
  useCreatePurchaseRecord,
  useOrder,
  useShipLineItem,
  useUpdateOrderStatus,
} from "@/hooks/useOrders";
import { useProduct } from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getNextAllowedOrderStatuses } from "@shared/logic/order-status";
import { resolveEffectiveCost } from "@shared/logic/product-variant";
import {
  calculateRemainingPurchaseQuantity,
  validatePurchaseQuantity,
} from "@shared/logic/purchase-record";
import {
  calculateRemainingShipQuantity,
  resolveStockQuantity,
  validateShipment,
} from "@shared/logic/shipment";
import type {
  LineItem,
  Order,
  OrderStatus,
  PurchaseRecord,
  Supplier,
} from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useCallback, useState } from "react";

export const Route = createFileRoute("/orders/$orderId")({
  beforeLoad: requireAuth,
  component: OrderDetailPage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORDER_STATUS_COLOR_MAP: Record<
  string,
  "primary" | "secondary" | "error" | "info" | "success" | "warning" | "inherit"
> = {
  pending: "warning",
  confirmed: "info",
  shipping: "primary",
  completed: "success",
  cancelled: "error",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  confirmed: "已確認",
  shipping: "出貨中",
  completed: "已完成",
  cancelled: "已取消",
};

const LINE_ITEM_STATUS_COLOR_MAP: Record<
  string,
  "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  待處理: "warning",
  已訂購: "info",
  已收到: "primary",
  已出貨: "success",
  缺貨: "error",
};

const PURCHASE_STATUS_LABEL: Record<string, string> = {
  pending: "待入庫",
  received: "已入庫",
  cancelled: "已取消",
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

async function searchSuppliers(query: string): Promise<Supplier[]> {
  const filter: Record<string, unknown> = { isActive: { eq: true } };
  if (query) {
    filter.or = [
      { name: { contains: query } },
      { contactPerson: { contains: query } },
    ];
  }
  const { data } = await client.models.Supplier.list({ filter, limit: 20 });
  return (data ?? []).map((raw: Record<string, unknown>) => ({
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    contactPerson: String(raw.contactPerson ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    isActive: true,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  }));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Purchase Dialog Component
// ---------------------------------------------------------------------------

interface PurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  lineItem: LineItem;
  order: Order;
}

function PurchaseDialog({
  open,
  onClose,
  lineItem,
  order,
}: PurchaseDialogProps): React.ReactElement {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const createPurchaseRecord = useCreatePurchaseRecord();
  const { data: product } = useProduct(lineItem.productId);

  // Set defaults when product loads
  const handleOpen = useCallback(() => {
    if (product) {
      // Default unit cost: use resolveEffectiveCost if variant exists
      if (lineItem.variantId && product.variants.length > 0) {
        const variant = product.variants.find(
          (v) => v.id === lineItem.variantId,
        );
        if (variant) {
          setUnitCost(resolveEffectiveCost(variant, product));
        } else {
          setUnitCost(product.defaultCost);
        }
      } else {
        setUnitCost(product.defaultCost);
      }
    }
    const remaining = calculateRemainingPurchaseQuantity(
      lineItem.quantity,
      lineItem.purchasedQuantity,
    );
    setQuantity(Math.max(1, remaining));
    setError(null);
  }, [product, lineItem]);

  // Trigger defaults when dialog opens
  useState(() => {
    if (open) handleOpen();
  });

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const remaining = calculateRemainingPurchaseQuantity(
      lineItem.quantity,
      lineItem.purchasedQuantity,
    );
    const validation = validatePurchaseQuantity(quantity, remaining);
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }
    if (!supplier) {
      setError("請選取供應商");
      return;
    }

    try {
      await createPurchaseRecord.mutateAsync({
        lineItemId: lineItem.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        quantity,
        unitCost,
        orderId: order.customerId,
        orderSortKey: order.id.split("|")[1] ?? "",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立採購記錄失敗");
    }
  };

  const remaining = calculateRemainingPurchaseQuantity(
    lineItem.quantity,
    lineItem.purchasedQuantity,
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        進貨採購 — {lineItem.productName}
        {lineItem.variantLabel ? ` (${lineItem.variantLabel})` : ""}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            訂購數量：{lineItem.quantity} 已採購：{lineItem.purchasedQuantity}{" "}
            未採購餘額：
            {remaining}
          </Typography>
          <EntitySelect<Supplier>
            label="供應商"
            value={supplier}
            onChange={setSupplier}
            searchFn={searchSuppliers}
            getOptionLabel={(s) => `${s.name}（${s.contactPerson}）`}
            required
          />
          <TextField
            label="採購數量"
            type="number"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            slotProps={{ htmlInput: { min: 1, max: remaining } }}
            fullWidth
            required
          />
          <TextField
            label="單位成本"
            type="number"
            value={unitCost}
            onChange={(e) =>
              setUnitCost(Math.max(0, Number(e.target.value) || 0))
            }
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            fullWidth
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          取消
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={createPurchaseRecord.isPending}
          startIcon={
            createPurchaseRecord.isPending ? (
              <CircularProgress size={16} />
            ) : undefined
          }
        >
          建立採購記錄
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Ship Dialog Component
// ---------------------------------------------------------------------------

interface ShipDialogProps {
  open: boolean;
  onClose: () => void;
  lineItem: LineItem;
  order: Order;
}

function ShipDialog({
  open,
  onClose,
  lineItem,
  order,
}: ShipDialogProps): React.ReactElement {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const shipLineItem = useShipLineItem();
  const { data: product } = useProduct(lineItem.productId);

  const remainingShip = calculateRemainingShipQuantity(
    lineItem.quantity,
    lineItem.shippedQuantity,
  );
  const stockQty = product
    ? resolveStockQuantity(product, lineItem.variantId)
    : 0;

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const validation = validateShipment(quantity, remainingShip, stockQty);
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }

    const [customerId, sortKey] = order.id.split("|");
    try {
      await shipLineItem.mutateAsync({
        orderId: customerId ?? "",
        orderSortKey: sortKey ?? "",
        lineItemId: lineItem.id,
        quantity,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "出貨操作失敗");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        出貨 — {lineItem.productName}
        {lineItem.variantLabel ? ` (${lineItem.variantLabel})` : ""}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            訂購數量：{lineItem.quantity} 已出貨：{lineItem.shippedQuantity}{" "}
            未出貨餘額：
            {remainingShip} 目前庫存：{stockQty}
          </Typography>
          <TextField
            label="出貨數量"
            type="number"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            slotProps={{
              htmlInput: { min: 1, max: Math.min(remainingShip, stockQty) },
            }}
            fullWidth
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          取消
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          color="primary"
          disabled={shipLineItem.isPending}
          startIcon={
            shipLineItem.isPending ? (
              <CircularProgress size={16} />
            ) : (
              <LocalShippingIcon />
            )
          }
        >
          確認出貨
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Line Item Row Component
// ---------------------------------------------------------------------------

interface LineItemRowProps {
  lineItem: LineItem;
  order: Order;
}

function LineItemRowComponent({
  lineItem,
  order,
}: LineItemRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [outOfStockConfirmOpen, setOutOfStockConfirmOpen] = useState(false);
  const confirmReceived = useConfirmReceived();
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const canPurchase =
    lineItem.status === "待處理" || lineItem.status === "已訂購";
  const canShip = lineItem.status === "已收到";
  const canMarkOutOfStock =
    lineItem.status === "待處理" || lineItem.status === "已訂購";

  const handleConfirmReceived = async (
    record: PurchaseRecord,
  ): Promise<void> => {
    setConfirmError(null);
    try {
      await confirmReceived.mutateAsync({
        purchaseRecordId: record.lineItemId,
        purchaseRecordSortKey: record.purchasedAt,
        lineItemId: record.lineItemId,
        orderId: order.customerId,
        orderSortKey: order.id.split("|")[1] ?? "",
      });
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "入庫確認失敗");
    }
  };

  const handleMarkOutOfStock = async (): Promise<void> => {
    try {
      await client.models.LineItem.update({
        id: lineItem.id,
        status: "缺貨",
      });
      setOutOfStockConfirmOpen(false);
      // The parent query will refetch
    } catch {
      // Silently fail - will be caught by query refetch
    }
  };

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{lineItem.productName}</TableCell>
        <TableCell>{lineItem.variantLabel ?? "—"}</TableCell>
        <TableCell align="right">{lineItem.quantity}</TableCell>
        <TableCell align="right">
          {lineItem.unitPrice.toLocaleString()}
        </TableCell>
        <TableCell align="right">
          {lineItem.subtotal.toLocaleString()}
        </TableCell>
        <TableCell align="center">
          <StatusChip
            status={lineItem.status}
            colorMap={LINE_ITEM_STATUS_COLOR_MAP}
          />
        </TableCell>
        <TableCell align="center">
          <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
            {canPurchase && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ShoppingCartIcon />}
                onClick={() => setPurchaseDialogOpen(true)}
              >
                進貨
              </Button>
            )}
            {canShip && (
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<LocalShippingIcon />}
                onClick={() => setShipDialogOpen(true)}
              >
                出貨
              </Button>
            )}
            {canMarkOutOfStock && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => setOutOfStockConfirmOpen(true)}
              >
                缺貨
              </Button>
            )}
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell sx={{ py: 0 }} colSpan={8}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                相關日期
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                訂購日期：{formatDate(lineItem.orderedAt)} 收到日期：
                {formatDate(lineItem.receivedAt)} 出貨日期：
                {formatDate(lineItem.shippedAt)}
              </Typography>

              {confirmError && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {confirmError}
                </Alert>
              )}

              {lineItem.purchaseRecords.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    採購記錄
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>供應商</TableCell>
                        <TableCell align="right">數量</TableCell>
                        <TableCell align="right">單位成本</TableCell>
                        <TableCell>採購日期</TableCell>
                        <TableCell align="center">狀態</TableCell>
                        <TableCell align="center">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lineItem.purchaseRecords.map((record) => (
                        <TableRow
                          key={`${record.lineItemId}-${record.purchasedAt}`}
                        >
                          <TableCell>{record.supplierName}</TableCell>
                          <TableCell align="right">{record.quantity}</TableCell>
                          <TableCell align="right">
                            {record.unitCost.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {formatDate(record.purchasedAt)}
                          </TableCell>
                          <TableCell align="center">
                            <StatusChip
                              status={
                                PURCHASE_STATUS_LABEL[record.status] ??
                                record.status
                              }
                              colorMap={{
                                待入庫: "warning",
                                已入庫: "success",
                                已取消: "error",
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {record.status === "pending" && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<CheckCircleIcon />}
                                onClick={() =>
                                  void handleConfirmReceived(record)
                                }
                                disabled={confirmReceived.isPending}
                              >
                                確認入庫
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={purchaseDialogOpen}
        onClose={() => setPurchaseDialogOpen(false)}
        lineItem={lineItem}
        order={order}
      />

      {/* Ship Dialog */}
      <ShipDialog
        open={shipDialogOpen}
        onClose={() => setShipDialogOpen(false)}
        lineItem={lineItem}
        order={order}
      />

      {/* Out of Stock Confirm */}
      <ConfirmDialog
        open={outOfStockConfirmOpen}
        title="標記缺貨"
        message={`確定要將「${lineItem.productName}${lineItem.variantLabel ? ` (${lineItem.variantLabel})` : ""}」標記為缺貨嗎？`}
        confirmLabel="確認標記"
        confirmColor="error"
        onConfirm={() => void handleMarkOutOfStock()}
        onCancel={() => setOutOfStockConfirmOpen(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

function OrderDetailPage(): React.ReactElement {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { data: order, isLoading, error: queryError } = useOrder(orderId);
  const updateStatus = useUpdateOrderStatus();
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleStatusChange = useCallback(
    async (newStatus: OrderStatus) => {
      if (!order) return;
      setStatusError(null);
      const [customerId, sortKey] = order.id.split("|");
      try {
        await updateStatus.mutateAsync({
          orderId: customerId ?? "",
          orderSortKey: sortKey ?? "",
          currentStatus: order.status,
          newStatus,
          statusHistory: order.statusHistory,
        });
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : "更新狀態失敗");
      }
    },
    [order, updateStatus],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (queryError || !order) {
    return (
      <Box>
        <Alert severity="error">{queryError?.message ?? "找不到該訂單"}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => void navigate({ to: "/orders" })}>
          返回訂單列表
        </Button>
      </Box>
    );
  }

  const allowedStatuses = getNextAllowedOrderStatuses(order.status);

  return (
    <Box>
      <PageHeader
        section="訂單"
        current={order.orderNumber}
        title="訂單詳情"
        actions={
          <>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => void navigate({ to: "/orders" })}
            >
              返回
            </Button>
            <Chip label={order.orderNumber} variant="outlined" />
            {(order.status === "pending" || order.status === "confirmed") &&
              order.lineItems.length >= 2 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    navigate({
                      to: "/orders/$orderId/split",
                      params: { orderId },
                    })
                  }
                >
                  分拆訂單
                </Button>
              )}
          </>
        }
      />

      {statusError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setStatusError(null)}
        >
          {statusError}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Order Info */}
        <Paper sx={{ p: 3 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Box>
              <Typography variant="h6" gutterBottom>
                訂單資訊
              </Typography>
              <Typography variant="body1">
                客戶：{order.customerName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                建立日期：{formatDate(order.createdAt)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                總金額：{order.totalAmount.toLocaleString()}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 1,
              }}
            >
              <StatusChip
                status={ORDER_STATUS_LABEL[order.status] ?? order.status}
                colorMap={{
                  待處理: "warning",
                  已確認: "info",
                  出貨中: "primary",
                  已完成: "success",
                  已取消: "error",
                }}
              />
              {allowedStatuses.length > 0 && (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {allowedStatuses.map((status) => (
                    <Button
                      key={status}
                      size="small"
                      variant="outlined"
                      color={ORDER_STATUS_COLOR_MAP[status] ?? "inherit"}
                      onClick={() => void handleStatusChange(status)}
                      disabled={updateStatus.isPending}
                    >
                      變更為「{ORDER_STATUS_LABEL[status] ?? status}」
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* Status History */}
          {order.statusHistory.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" gutterBottom>
                狀態歷史
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {order.statusHistory.map((change, idx) => (
                  <Chip
                    key={idx}
                    size="small"
                    variant="outlined"
                    label={`${ORDER_STATUS_LABEL[change.fromStatus] ?? change.fromStatus} → ${ORDER_STATUS_LABEL[change.toStatus] ?? change.toStatus}（${formatDate(change.changedAt)}）`}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Line Items */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            明細項目
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50 }} />
                  <TableCell>商品名稱</TableCell>
                  <TableCell>規格組合</TableCell>
                  <TableCell align="right">數量</TableCell>
                  <TableCell align="right">單價</TableCell>
                  <TableCell align="right">小計</TableCell>
                  <TableCell align="center">狀態</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.lineItems.map((lineItem) => (
                  <LineItemRowComponent
                    key={lineItem.id}
                    lineItem={lineItem}
                    order={order}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              mt: 2,
              pt: 2,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="h6">
              總金額：{order.totalAmount.toLocaleString()}
            </Typography>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}
