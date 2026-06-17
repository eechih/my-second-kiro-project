import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CursorPagination } from "@/components/CursorPagination";
import { StatusChip } from "@/components/StatusChip";
import { useCustomerOrderList, useMergeOrders } from "@/hooks/useOrders";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { formatCurrency } from "@/lib/currency";
import { validateMergeOrders } from "@shared/logic/order-merge";
import type { Order } from "@shared/models";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ORDER_STATUS_LABEL } from "@shared/models";
import { ORDER_STATUS_COLOR_MAP } from "../../orders/-components/detail/detailUtils";

const PAGE_SIZE = 10;

function isMergeableOrder(order: Order): boolean {
  return order.status === "PENDING" || order.status === "ORDERED";
}

export interface CustomerMergePanelProps {
  customerId: string;
  customerName: string;
}

export function CustomerMergePanel({
  customerId,
  customerName,
}: CustomerMergePanelProps): React.ReactElement {
  const navigate = useNavigate();
  const {
    currentToken,
    pageSize,
    tokenStack,
    goNext,
    goPrev,
    setPageSize,
    reset,
  } = useCursorPagination(PAGE_SIZE);
  const mergeOrders = useMergeOrders();
  const { data, isLoading, error } = useCustomerOrderList({
    customerId,
    pageSize,
    nextToken: currentToken,
  });
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    reset();
    setSelectedOrderIds(new Set());
    setSubmitError(null);
  }, [customerId, reset]);

  const orders = useMemo(() => data?.items ?? [], [data?.items]);
  const mergeableOrders = useMemo(
    () => orders.filter((order) => isMergeableOrder(order)),
    [orders],
  );
  const selectedOrders = useMemo(
    () => mergeableOrders.filter((order) => selectedOrderIds.has(order.id)),
    [mergeableOrders, selectedOrderIds],
  );
  const totalAmount = useMemo(
    () => selectedOrders.reduce((sum, order) => sum + order.totalAmount, 0),
    [selectedOrders],
  );
  const totalItemCount = useMemo(
    () => selectedOrders.reduce((sum, order) => sum + order.items.length, 0),
    [selectedOrders],
  );

  const toggleOrder = (orderId: string): void => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
    setSubmitError(null);
  };

  const toggleSelectAll = (): void => {
    setSelectedOrderIds((prev) =>
      prev.size === mergeableOrders.length
        ? new Set()
        : new Set(mergeableOrders.map((order) => order.id)),
    );
    setSubmitError(null);
  };

  const handleMergeClick = (): void => {
    const validation = validateMergeOrders(selectedOrders);
    if (!validation.valid) {
      setSubmitError(validation.error ?? "驗證失敗");
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmMerge = async (): Promise<void> => {
    setConfirmOpen(false);
    setSubmitError(null);

    try {
      const result = await mergeOrders.mutateAsync({
        orderIds: Array.from(selectedOrderIds),
      });
      void navigate({
        to: "/orders/$orderId" as string,
        params: { orderId: result.id } as Record<string, string>,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "合併訂單失敗");
    }
  };

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            合併訂單
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            依客戶查看「{customerName}」尚未履約的訂單，直接挑選後合併。
          </Typography>
        </Box>

        {submitError ? (
          <Alert severity="error" onClose={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        ) : null}

        {error ? (
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢客戶訂單失敗"}
          </Alert>
        ) : null}

        {isLoading ? (
          <Paper
            variant="outlined"
            sx={{ display: "flex", justifyContent: "center", py: 6 }}
          >
            <CircularProgress />
          </Paper>
        ) : mergeableOrders.length === 0 ? (
          <Alert severity="info">
            此客戶目前沒有可合併的訂單（需為待付款或已付款，且尚未進入履約）。
          </Alert>
        ) : (
          <>
            <TableContainer component={Paper} variant="outlined">
              <Table sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={
                          mergeableOrders.length > 0 &&
                          selectedOrderIds.size === mergeableOrders.length
                        }
                        indeterminate={
                          selectedOrderIds.size > 0 &&
                          selectedOrderIds.size < mergeableOrders.length
                        }
                        onChange={toggleSelectAll}
                      />
                    </TableCell>
                    <TableCell>訂單編號</TableCell>
                    <TableCell align="center">訂單狀態</TableCell>
                    <TableCell align="right">總金額</TableCell>
                    <TableCell align="center">明細數</TableCell>
                    <TableCell align="center">建立日期</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mergeableOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      hover
                      onClick={() => toggleOrder(order.id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={selectedOrderIds.has(order.id)} />
                      </TableCell>
                      <TableCell>{order.orderNumber}</TableCell>
                      <TableCell align="center">
                        <StatusChip
                          status={order.status}
                          label={ORDER_STATUS_LABEL[order.status]}
                          colorMap={ORDER_STATUS_COLOR_MAP}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell align="center">{order.items.length}</TableCell>
                      <TableCell align="center">
                        {new Date(order.createdAt).toLocaleDateString("zh-TW")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                justifyContent: "space-between",
                gap: 2,
                alignItems: { xs: "stretch", md: "center" },
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  已選取 {selectedOrders.length} 筆訂單
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  合併後總金額 {formatCurrency(totalAmount)}，共 {totalItemCount} 項明細
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={
                  mergeOrders.isPending ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <CallMergeIcon />
                  )
                }
                disabled={selectedOrders.length < 2 || mergeOrders.isPending}
                onClick={handleMergeClick}
              >
                {mergeOrders.isPending ? "合併中..." : "確認合併"}
              </Button>
            </Box>

            <CursorPagination
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              hasNextPage={!!data?.nextToken}
              hasPrevPage={tokenStack.length > 0}
              onNextPage={() => {
                if (data?.nextToken) goNext(data.nextToken);
              }}
              onPrevPage={goPrev}
              currentCount={orders.length}
            />
          </>
        )}
      </Stack>

      <ConfirmDialog
        open={confirmOpen}
        title="確認合併訂單"
        message={`確定要將 ${selectedOrders.length} 筆「${customerName}」的訂單合併為一筆新訂單嗎？來源訂單將被取消，此操作無法復原。`}
        onConfirm={() => void handleConfirmMerge()}
        onCancel={() => setConfirmOpen(false)}
      />
    </Paper>
  );
}
