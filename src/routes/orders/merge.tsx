import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { StatusChip } from "@/components/StatusChip";
import { useMergeOrders, useOrder, useOrderList } from "@/hooks/useOrders";
import { client } from "@/lib/amplify-client";
import { requireAuth } from "@/lib/route-guards";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MergeIcon from "@mui/icons-material/CallMerge";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { validateMergeOrders } from "@shared/logic/order-merge";
import type { Order } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/orders/merge")({
  beforeLoad: requireAuth,
  component: OrderMergePage,
});

/** 訂單狀態中文標籤 */
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  confirmed: "已確認",
  shipping: "出貨中",
  completed: "已完成",
  cancelled: "已取消",
};

interface CustomerOption {
  id: string;
  name: string;
}

function OrderMergePage() {
  const navigate = useNavigate();
  const mergeOrders = useMergeOrders();

  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadedOrders, setLoadedOrders] = useState<Map<string, Order>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // 查詢選定客戶的 pending/confirmed 訂單
  const { data: ordersData, isLoading: orderIdsLoading } = useOrderList({
    pageSize: 100,
    search: selectedCustomer?.name,
  });
  const orderIds = useMemo(() => ordersData?.items ?? [], [ordersData?.items]);

  // 篩選出屬於選定客戶且狀態為 pending 或 confirmed 的訂單
  const mergeableOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return orderIds
      .map((orderId) => loadedOrders.get(orderId))
      .filter((order): order is Order => !!order)
      .filter(
        (order) =>
          order.customerId === selectedCustomer.id &&
          (order.status === "pending" || order.status === "confirmed"),
      );
  }, [selectedCustomer, orderIds, loadedOrders]);

  const ordersLoading =
    orderIdsLoading ||
    (orderIds.length > 0 && loadedOrders.size < orderIds.length);

  const handleOrderLoaded = useCallback((order: Order): void => {
    setLoadedOrders((prev) => {
      const current = prev.get(order.id);
      if (
        current &&
        current.status === order.status &&
        current.totalAmount === order.totalAmount &&
        current.lineItems.length === order.lineItems.length &&
        current.updatedAt === order.updatedAt
      ) {
        return prev;
      }

      const next = new Map(prev);
      next.set(order.id, order);
      return next;
    });
  }, []);

  // 搜尋客戶函式
  const searchCustomers = useCallback(
    async (query: string): Promise<CustomerOption[]> => {
      const filter: Record<string, unknown> = {
        isActive: { eq: true },
      };
      if (query) {
        filter.or = [
          { name: { contains: query } },
          { contactPerson: { contains: query } },
        ];
      }

      const { data } = await client.models.Customer.list({
        filter,
        limit: 20,
      });

      return (data ?? []).map((c) => ({
        id: String(c.id ?? ""),
        name: String(c.name ?? ""),
      }));
    },
    [],
  );

  // 切換訂單選取
  const toggleOrderSelection = (orderId: string): void => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
    setError(null);
  };

  // 全選/取消全選
  const toggleSelectAll = (): void => {
    if (selectedOrderIds.size === mergeableOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(mergeableOrders.map((o) => o.id)));
    }
    setError(null);
  };

  // 取得選取的訂單物件
  const selectedOrders = useMemo(
    () => mergeableOrders.filter((o) => selectedOrderIds.has(o.id)),
    [mergeableOrders, selectedOrderIds],
  );

  // 合併前驗證
  const handleMergeClick = (): void => {
    const validation = validateMergeOrders(selectedOrders);
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }
    setShowConfirm(true);
  };

  // 執行合併
  const handleConfirmMerge = async (): Promise<void> => {
    setShowConfirm(false);
    setError(null);

    try {
      const result = await mergeOrders.mutateAsync({
        orderIds: Array.from(selectedOrderIds),
      });
      // 導向新訂單詳情頁面
      void navigate({
        to: "/orders/$orderId" as string,
        params: { orderId: result.id } as Record<string, string>,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "合併訂單失敗");
    }
  };

  // 計算合併後總金額
  const totalMergedAmount = selectedOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );

  return (
    <Box>
      <PageHeader
        section="訂單"
        current="合併"
        title="合併訂單"
        actions={
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate({ to: "/orders" })}
          >
            返回
          </Button>
        }
      />

      {/* 錯誤訊息 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 步驟 1：選取客戶 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          步驟 1：選取客戶
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          僅能合併同一客戶的訂單，請先選取客戶。
        </Typography>
        <Box sx={{ maxWidth: 400 }}>
          <EntitySelect<CustomerOption>
            label="客戶"
            value={selectedCustomer}
            onChange={(customer) => {
              setSelectedCustomer(customer);
              setSelectedOrderIds(new Set());
              setLoadedOrders(new Map());
              setError(null);
            }}
            searchFn={searchCustomers}
            getOptionLabel={(option) => option.name}
            required
          />
        </Box>
      </Paper>

      {/* 步驟 2：選取訂單 */}
      {selectedCustomer && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            步驟 2：選取要合併的訂單
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            僅顯示狀態為「待處理」或「已確認」的訂單。至少需選取兩筆訂單。
          </Typography>

          {orderIdsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : orderIds.length === 0 ||
            (!ordersLoading && mergeableOrders.length === 0) ? (
            <Alert severity="info">
              此客戶目前沒有可合併的訂單（需為待處理或已確認狀態）。
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={
                          selectedOrderIds.size > 0 &&
                          selectedOrderIds.size < mergeableOrders.length
                        }
                        checked={
                          mergeableOrders.length > 0 &&
                          selectedOrderIds.size === mergeableOrders.length
                        }
                        onChange={toggleSelectAll}
                      />
                    </TableCell>
                    <TableCell>訂單編號</TableCell>
                    <TableCell align="center">狀態</TableCell>
                    <TableCell align="right">總金額</TableCell>
                    <TableCell>明細數量</TableCell>
                    <TableCell>建立日期</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderIds.map((orderId) => (
                    <MergeOrderTableRow
                      key={orderId}
                      orderId={orderId}
                      selected={selectedOrderIds.has(orderId)}
                      selectedCustomerId={selectedCustomer.id}
                      onToggle={toggleOrderSelection}
                      onOrderLoaded={handleOrderLoaded}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* 合併預覽與操作 */}
      {selectedOrderIds.size >= 2 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            合併預覽
          </Typography>
          <Box sx={{ display: "flex", gap: 4, mb: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                選取訂單數
              </Typography>
              <Typography variant="h5">{selectedOrderIds.size} 筆</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                合併後總金額
              </Typography>
              <Typography variant="h5">
                ${totalMergedAmount.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                合併後明細項目數
              </Typography>
              <Typography variant="h5">
                {selectedOrders.reduce((sum, o) => sum + o.lineItems.length, 0)}{" "}
                項
              </Typography>
            </Box>
          </Box>
          <Alert severity="warning" sx={{ mb: 2 }}>
            合併後，所有來源訂單將被取消，並建立一筆包含所有明細項目的新訂單。此操作無法復原。
          </Alert>
          <Button
            variant="contained"
            startIcon={
              mergeOrders.isPending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <MergeIcon />
              )
            }
            onClick={handleMergeClick}
            disabled={mergeOrders.isPending}
          >
            {mergeOrders.isPending ? "合併中..." : "確認合併"}
          </Button>
        </Paper>
      )}

      {/* 確認對話框 */}
      <ConfirmDialog
        open={showConfirm}
        title="確認合併訂單"
        message={`確定要將 ${selectedOrderIds.size} 筆訂單合併為一筆新訂單嗎？來源訂單將被取消，此操作無法復原。`}
        onConfirm={() => void handleConfirmMerge()}
        onCancel={() => setShowConfirm(false)}
      />
    </Box>
  );
}

interface MergeOrderTableRowProps {
  orderId: string;
  selected: boolean;
  selectedCustomerId: string;
  onToggle: (orderId: string) => void;
  onOrderLoaded: (order: Order) => void;
}

function MergeOrderTableRow({
  orderId,
  selected,
  selectedCustomerId,
  onToggle,
  onOrderLoaded,
}: MergeOrderTableRowProps): React.ReactElement | null {
  const { data: order, isLoading, error } = useOrder(orderId);

  useEffect(() => {
    if (order) onOrderLoaded(order);
  }, [order, onOrderLoaded]);

  if (isLoading) {
    return (
      <TableRow hover>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} disabled />
        </TableCell>
        <TableCell colSpan={5}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography color="text.secondary">載入訂單資料中...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  if (error || !order) {
    return (
      <TableRow hover>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} disabled />
        </TableCell>
        <TableCell colSpan={5}>
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢訂單失敗"}
          </Alert>
        </TableCell>
      </TableRow>
    );
  }

  if (
    order.customerId !== selectedCustomerId ||
    (order.status !== "pending" && order.status !== "confirmed")
  ) {
    return null;
  }

  return (
    <TableRow
      hover
      onClick={() => onToggle(order.id)}
      sx={{ cursor: "pointer" }}
    >
      <TableCell padding="checkbox">
        <Checkbox checked={selected} />
      </TableCell>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell align="center">
        <StatusChip
          status={ORDER_STATUS_LABEL[order.status] ?? order.status}
          colorMap={{
            待處理: "warning",
            已確認: "info",
          }}
        />
      </TableCell>
      <TableCell align="right">${order.totalAmount.toLocaleString()}</TableCell>
      <TableCell>{order.lineItems.length} 項</TableCell>
      <TableCell>
        {order.createdAt
          ? new Date(order.createdAt).toLocaleDateString("zh-TW")
          : ""}
      </TableCell>
    </TableRow>
  );
}
