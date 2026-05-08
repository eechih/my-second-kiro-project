import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
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
import type { Order } from "@shared/models";
import { MergeOrderTableRow } from "./MergeOrderTableRow";

export interface OrderMergeSelectionTableProps {
  orderIds: string[];
  selectedOrderIds: Set<string>;
  selectedCustomerId: string;
  mergeableOrderCount: number;
  orderIdsLoading: boolean;
  ordersLoading: boolean;
  onToggleOrder: (orderId: string) => void;
  onToggleSelectAll: () => void;
  onOrderLoaded: (order: Order) => void;
}

export function OrderMergeSelectionTable({
  orderIds,
  selectedOrderIds,
  selectedCustomerId,
  mergeableOrderCount,
  orderIdsLoading,
  ordersLoading,
  onToggleOrder,
  onToggleSelectAll,
  onOrderLoaded,
}: OrderMergeSelectionTableProps): React.ReactElement {
  return (
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
      ) : orderIds.length === 0 || (!ordersLoading && mergeableOrderCount === 0) ? (
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
                      selectedOrderIds.size < mergeableOrderCount
                    }
                    checked={
                      mergeableOrderCount > 0 &&
                      selectedOrderIds.size === mergeableOrderCount
                    }
                    onChange={onToggleSelectAll}
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
                  selectedCustomerId={selectedCustomerId}
                  onToggle={onToggleOrder}
                  onOrderLoaded={onOrderLoaded}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
