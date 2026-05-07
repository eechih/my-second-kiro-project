import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { useOrder, useSplitOrder } from "@/hooks/useOrders";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { calculateOrderTotal } from "@shared/logic/order-calculations";
import { validateSplitOrder } from "@shared/logic/order-split";
import type { LineItem, SplitAllocation } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/orders/$orderId/split")({
  beforeLoad: requireAuth,
  component: OrderSplitPage,
});

function OrderSplitPage() {
  const navigate = useNavigate();
  const { orderId } = Route.useParams();
  const { data: order, isLoading } = useOrder(orderId);
  const splitOrder = useSplitOrder();

  // 每個明細項目分配到哪筆新訂單（0-based index）
  const [allocations, setAllocations] = useState<Map<string, number>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // 可用的新訂單數量（最多等於明細項目數量，最少 2）
  const maxNewOrders = Math.max(order?.lineItems.length ?? 2, 2);

  // 更新分配
  const handleAllocationChange = (
    lineItemId: string,
    targetIndex: number,
  ): void => {
    setAllocations((prev) => {
      const next = new Map(prev);
      next.set(lineItemId, targetIndex);
      return next;
    });
    setError(null);
  };

  // 建立 SplitAllocation 陣列
  const splitAllocations: SplitAllocation[] = useMemo(() => {
    return Array.from(allocations.entries()).map(
      ([lineItemId, targetOrderIndex]) => ({
        lineItemId,
        targetOrderIndex,
      }),
    );
  }, [allocations]);

  // 分拆預覽：依 targetOrderIndex 分組
  const splitPreview = useMemo(() => {
    if (!order) return [];

    const groups = new Map<number, LineItem[]>();
    for (const [lineItemId, targetIndex] of allocations.entries()) {
      const lineItem = order.lineItems.find((li) => li.id === lineItemId);
      if (lineItem) {
        const group = groups.get(targetIndex);
        if (group) {
          group.push(lineItem);
        } else {
          groups.set(targetIndex, [lineItem]);
        }
      }
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([index, lineItems]) => ({
        index,
        lineItems,
        totalAmount: calculateOrderTotal(lineItems),
      }));
  }, [order, allocations]);

  // 已使用的新訂單索引數量
  const usedOrderIndices = new Set(allocations.values());

  // 驗證並顯示確認對話框
  const handleSplitClick = (): void => {
    if (!order) return;

    const validation = validateSplitOrder(order, splitAllocations);
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }
    setShowConfirm(true);
  };

  // 執行分拆
  const handleConfirmSplit = async (): Promise<void> => {
    setShowConfirm(false);
    setError(null);

    try {
      await splitOrder.mutateAsync({
        orderId,
        allocations: splitAllocations,
      });
      // 導向訂單列表頁面
      void navigate({ to: "/orders" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "分拆訂單失敗");
    }
  };

  // 載入中
  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // 訂單不存在
  if (!order) {
    return (
      <Box>
        <Alert severity="error">找不到該訂單</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate({ to: "/orders" })}
          sx={{ mt: 2 }}
        >
          返回訂單列表
        </Button>
      </Box>
    );
  }

  // 檢查訂單是否可分拆
  const canSplit = order.status === "pending" || order.status === "confirmed";

  return (
    <Box>
      <PageHeader
        section="訂單"
        current="分拆"
        title="分拆訂單"
        actions={
          <>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() =>
                navigate({
                  to: "/orders/$orderId" as string,
                  params: { orderId } as Record<string, string>,
                })
              }
            >
              返回
            </Button>
            <Chip label={order.orderNumber} variant="outlined" />
          </>
        }
      />

      {/* 錯誤訊息 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 不可分拆提示 */}
      {!canSplit && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          僅能分拆狀態為「待處理」或「已確認」的訂單。目前訂單狀態為「
          {order.status}」。
        </Alert>
      )}

      {/* 訂單資訊 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          訂單資訊
        </Typography>
        <Box sx={{ display: "flex", gap: 4 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              客戶
            </Typography>
            <Typography>{order.customerName}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              總金額
            </Typography>
            <Typography>${order.totalAmount.toLocaleString()}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              明細項目數
            </Typography>
            <Typography>{order.lineItems.length} 項</Typography>
          </Box>
        </Box>
      </Paper>

      {/* 明細分配 */}
      {canSplit && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            明細項目分配
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            為每個明細項目指定要分配到的新訂單。至少需要分配到兩筆不同的新訂單。
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>商品名稱</TableCell>
                  <TableCell>規格</TableCell>
                  <TableCell align="right">數量</TableCell>
                  <TableCell align="right">單價</TableCell>
                  <TableCell align="right">小計</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>分配至</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.lineItems.map((lineItem) => (
                  <TableRow key={lineItem.id}>
                    <TableCell>{lineItem.productName}</TableCell>
                    <TableCell>{lineItem.variantLabel ?? "-"}</TableCell>
                    <TableCell align="right">{lineItem.quantity}</TableCell>
                    <TableCell align="right">
                      ${lineItem.unitPrice.toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      ${lineItem.subtotal.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={allocations.get(lineItem.id) ?? ""}
                          onChange={(e) =>
                            handleAllocationChange(
                              lineItem.id,
                              Number(e.target.value),
                            )
                          }
                          displayEmpty
                        >
                          <MenuItem value="" disabled>
                            選取
                          </MenuItem>
                          {Array.from(
                            {
                              length: Math.min(
                                maxNewOrders,
                                order.lineItems.length,
                              ),
                            },
                            (_, i) => (
                              <MenuItem key={i} value={i}>
                                新訂單 {i + 1}
                              </MenuItem>
                            ),
                          )}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* 分拆預覽 */}
      {canSplit && splitPreview.length >= 2 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            分拆預覽
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            將產生 {usedOrderIndices.size} 筆新訂單，原訂單將被取消。
          </Alert>

          {splitPreview.map((group, idx) => (
            <Box key={group.index}>
              {idx > 0 && <Divider sx={{ my: 2 }} />}
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  新訂單 {group.index + 1}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {group.lineItems.length} 項明細，總金額 $
                  {group.totalAmount.toLocaleString()}
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>商品名稱</TableCell>
                      <TableCell>規格</TableCell>
                      <TableCell align="right">數量</TableCell>
                      <TableCell align="right">小計</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.lineItems.map((li) => (
                      <TableRow key={li.id}>
                        <TableCell>{li.productName}</TableCell>
                        <TableCell>{li.variantLabel ?? "-"}</TableCell>
                        <TableCell align="right">{li.quantity}</TableCell>
                        <TableCell align="right">
                          ${li.subtotal.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Paper>
      )}

      {/* 操作按鈕 */}
      {canSplit && (
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            startIcon={
              splitOrder.isPending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <CallSplitIcon />
              )
            }
            onClick={handleSplitClick}
            disabled={
              splitOrder.isPending ||
              allocations.size !== order.lineItems.length ||
              usedOrderIndices.size < 2
            }
          >
            {splitOrder.isPending ? "分拆中..." : "確認分拆"}
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              navigate({
                to: "/orders/$orderId" as string,
                params: { orderId } as Record<string, string>,
              })
            }
          >
            取消
          </Button>
        </Box>
      )}

      {/* 確認對話框 */}
      <ConfirmDialog
        open={showConfirm}
        title="確認分拆訂單"
        message={`確定要將此訂單分拆為 ${usedOrderIndices.size} 筆新訂單嗎？原訂單將被取消，此操作無法復原。`}
        onConfirm={() => void handleConfirmSplit()}
        onCancel={() => setShowConfirm(false)}
      />
    </Box>
  );
}
