import { StatusChip } from "@/components/StatusChip";
import { listTableBodyTextSx } from "@/components/listTableStyles";
import { formatCurrency } from "@/lib/currency";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Order } from "@shared/models";
import { ORDER_STATUS_LABEL } from "@shared/models";
import { formatOrderDate } from "./tableUtils";

const ORDER_STATUS_COLOR_MAP: Record<
  string,
  "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  待處理: "warning",
  已確認: "info",
  出貨中: "primary",
  已完成: "success",
  已取消: "error",
};

export interface OrderTableProps {
  orders: Order[];
  isLoading: boolean;
  onEdit: (orderId: string) => void;
}

export function OrderTable({
  orders,
  isLoading,
  onEdit,
}: OrderTableProps): React.ReactElement {
  return (
    <Box sx={{ mt: 0.5 }}>
      {isLoading ? (
        <Paper sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Paper>
      ) : orders.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有符合條件的訂單資料
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={listTableBodyTextSx}>
            <TableHead>
              <TableRow>
                <TableCell>訂單編號</TableCell>
                <TableCell>客戶</TableCell>
                <TableCell>商品</TableCell>
                <TableCell align="right">數量</TableCell>
                <TableCell align="right">金額</TableCell>
                <TableCell align="center">狀態</TableCell>
                <TableCell>日期</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => onEdit(order.id)}
                >
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{order.customerNameSnapshot}</TableCell>
                  <TableCell>{order.productNameSnapshot}</TableCell>
                  <TableCell align="right">{order.quantity}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(order.totalAmount)}
                  </TableCell>
                  <TableCell align="center">
                    <StatusChip
                      status={ORDER_STATUS_LABEL[order.status] ?? order.status}
                      colorMap={ORDER_STATUS_COLOR_MAP}
                    />
                  </TableCell>
                  <TableCell>{formatOrderDate(order.createdAt)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="編輯">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(order.id);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
