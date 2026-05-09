import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusChip } from "@/components/StatusChip";
import { useConfirmReceived } from "@/hooks/useOrders";
import { client } from "@/lib/amplify-client";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { LineItem, Order } from "@shared/models";
import { useState } from "react";
import {
  formatDate,
  LINE_ITEM_STATUS_COLOR_MAP,
} from "./orderDetailUtils";
import { PurchaseDialog } from "./PurchaseDialog";
import { ShipDialog } from "./ShipDialog";

export interface OrderLineItemDetailRowProps {
  lineItem: LineItem;
  order: Order;
}

export function OrderLineItemDetailRow({
  lineItem,
  order,
}: OrderLineItemDetailRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [outOfStockConfirmOpen, setOutOfStockConfirmOpen] = useState(false);
  const [cancelProcurementConfirmOpen, setCancelProcurementConfirmOpen] = useState(false);
  const confirmReceived = useConfirmReceived();
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const canMarkProcurement = lineItem.status === "待處理";
  const canShip = lineItem.status === "已收到";
  const canConfirmReceived = lineItem.status === "已訂購";
  const canCancelProcurement = lineItem.status === "已訂購";
  const canMarkOutOfStock =
    lineItem.status === "待處理" || lineItem.status === "已訂購";

  const handleConfirmReceived = async (): Promise<void> => {
    setConfirmError(null);
    try {
      await confirmReceived.mutateAsync({
        lineItemId: lineItem.id,
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
    } catch {
      // The next refetch surfaces persistence issues.
    }
  };

  const handleCancelProcurement = async (): Promise<void> => {
    try {
      await client.models.LineItem.update({
        id: lineItem.id,
        status: "缺貨",
        purchasedQuantity: 0,
      });
      setCancelProcurementConfirmOpen(false);
    } catch {
      // The next refetch surfaces persistence issues.
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
        <TableCell align="right">{lineItem.subtotal.toLocaleString()}</TableCell>
        <TableCell>
          <Typography variant="body2" color={lineItem.supplierName ? "text.primary" : "text.secondary"}>
            {lineItem.supplierName ?? "—"}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" color={lineItem.unitCost != null ? "text.primary" : "text.secondary"}>
            {lineItem.unitCost != null ? lineItem.unitCost.toLocaleString() : "—"}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <StatusChip
            status={lineItem.status}
            colorMap={LINE_ITEM_STATUS_COLOR_MAP}
          />
        </TableCell>
        <TableCell align="center">
          <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
            {canMarkProcurement && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ShoppingCartIcon />}
                onClick={() => setPurchaseDialogOpen(true)}
              >
                標記採購
              </Button>
            )}
            {canConfirmReceived && (
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => void handleConfirmReceived()}
                disabled={confirmReceived.isPending}
              >
                確認入庫
              </Button>
            )}
            {canCancelProcurement && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => setCancelProcurementConfirmOpen(true)}
              >
                取消採購
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
                color="warning"
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
        <TableCell sx={{ py: 0 }} colSpan={10}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                相關日期
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                採購日期：{formatDate(lineItem.purchasedAt)} 收到日期：
                {formatDate(lineItem.receivedAt)} 出貨日期：
                {formatDate(lineItem.shippedAt)}
              </Typography>

              {lineItem.supplierName && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  供應商：{lineItem.supplierName} 單位成本：{lineItem.unitCost != null ? lineItem.unitCost.toLocaleString() : "—"}
                </Typography>
              )}

              {confirmError && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {confirmError}
                </Alert>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <PurchaseDialog
        open={purchaseDialogOpen}
        onClose={() => setPurchaseDialogOpen(false)}
        lineItem={lineItem}
        order={order}
      />
      <ShipDialog
        open={shipDialogOpen}
        onClose={() => setShipDialogOpen(false)}
        lineItem={lineItem}
        order={order}
      />
      <ConfirmDialog
        open={outOfStockConfirmOpen}
        title="標記缺貨"
        message={`確定要將「${lineItem.productName}${lineItem.variantLabel ? ` (${lineItem.variantLabel})` : ""}」標記為缺貨嗎？`}
        confirmLabel="確認標記"
        confirmColor="error"
        onConfirm={() => void handleMarkOutOfStock()}
        onCancel={() => setOutOfStockConfirmOpen(false)}
      />
      <ConfirmDialog
        open={cancelProcurementConfirmOpen}
        title="取消採購"
        message={`確定要取消「${lineItem.productName}${lineItem.variantLabel ? ` (${lineItem.variantLabel})` : ""}」的採購嗎？狀態將轉為「缺貨」。`}
        confirmLabel="確認取消"
        confirmColor="error"
        onConfirm={() => void handleCancelProcurement()}
        onCancel={() => setCancelProcurementConfirmOpen(false)}
      />
    </>
  );
}
