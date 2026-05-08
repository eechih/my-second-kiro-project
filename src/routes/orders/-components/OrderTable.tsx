import { listTableBodyTextSx } from "@/components/listTableStyles";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { OrderTableRow } from "./OrderTableRow";

export interface OrderTableProps {
  orderIds: string[];
  isLoading: boolean;
  onEdit: (orderId: string) => void;
}

export function OrderTable({
  orderIds,
  isLoading,
  onEdit,
}: OrderTableProps): React.ReactElement {
  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table sx={listTableBodyTextSx}>
          <TableHead>
            <TableRow>
              <TableCell>訂單編號</TableCell>
              <TableCell>客戶名稱</TableCell>
              <TableCell>訂購日期</TableCell>
              <TableCell align="center">狀態</TableCell>
              <TableCell align="right">總金額</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orderIds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    目前沒有符合條件的訂單資料
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              orderIds.map((orderId) => (
                <OrderTableRow
                  key={orderId}
                  orderId={orderId}
                  onEdit={onEdit}
                />
              ))
            )}
          </TableBody>
        </Table>
      )}
    </TableContainer>
  );
}
