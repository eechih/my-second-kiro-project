import { StatusChip } from "@/components/StatusChip";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { Order, OrderStatus } from "@shared/models";
import {
  formatDate,
  ORDER_STATUS_COLOR_MAP,
  ORDER_STATUS_LABEL,
} from "./orderDetailUtils";

export interface OrderInfoCardProps {
  order: Order;
  allowedStatuses: OrderStatus[];
  statusPending: boolean;
  onStatusChange: (status: OrderStatus) => void;
}

export function OrderInfoCard({
  order,
  allowedStatuses,
  statusPending,
  onStatusChange,
}: OrderInfoCardProps): React.ReactElement {
  return (
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
          <Typography variant="body1">客戶：{order.customerName}</Typography>
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
                  onClick={() => onStatusChange(status)}
                  disabled={statusPending}
                >
                  變更為「{ORDER_STATUS_LABEL[status] ?? status}」
                </Button>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {order.statusHistory.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="subtitle2" gutterBottom>
            狀態歷史
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {order.statusHistory.map((change, index) => (
              <Chip
                key={index}
                size="small"
                variant="outlined"
                label={`${ORDER_STATUS_LABEL[change.fromStatus] ?? change.fromStatus} → ${ORDER_STATUS_LABEL[change.toStatus] ?? change.toStatus}（${formatDate(change.changedAt)}）`}
              />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
