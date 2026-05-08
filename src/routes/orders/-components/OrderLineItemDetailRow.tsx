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
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { LineItem, Order, PurchaseRecord } from "@shared/models";
import { useState } from "react";
import {
  formatDate,
  LINE_ITEM_STATUS_COLOR_MAP,
  PURCHASE_STATUS_LABEL,
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
                          <TableCell>{formatDate(record.purchasedAt)}</TableCell>
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
    </>
  );
}
