import { listTableBodyTextSx } from "@/components/listTableStyles";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { Order } from "@shared/models";
import { OrderTableRow } from "./OrderTableRow";

export interface OrderTableProps {
  orderIds: string[];
  isLoading: boolean;
  selectedOrderIds: ReadonlySet<string>;
  onEdit: (orderId: string) => void;
  onSelectionChange: (orderId: string, selected: boolean) => void;
  onOrderLoaded: (order: Order) => void;
}

export function OrderTable({
  orderIds,
  isLoading,
  selectedOrderIds,
  onEdit,
  onSelectionChange,
  onOrderLoaded,
}: OrderTableProps): React.ReactElement {
  return (
    <Box sx={{ mt: 2 }}>
      {isLoading ? (
        <Paper sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Paper>
      ) : orderIds.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有符合條件的訂單資料
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" sx={listTableBodyTextSx}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">選取</TableCell>
                  <TableCell>訂單編號</TableCell>
                  <TableCell>客戶名稱</TableCell>
                  <TableCell>訂購日期</TableCell>
                  <TableCell align="center">狀態</TableCell>
                  <TableCell align="right">總金額</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
            </Table>
          </TableContainer>
          {orderIds.map((orderId) => (
            <OrderTableRow
              key={orderId}
              orderId={orderId}
              selected={selectedOrderIds.has(orderId)}
              onEdit={onEdit}
              onSelectionChange={(selected) =>
                onSelectionChange(orderId, selected)
              }
              onOrderLoaded={onOrderLoaded}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
