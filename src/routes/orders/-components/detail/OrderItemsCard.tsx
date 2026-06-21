import { formatCurrency } from "@/lib/currency";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { Order } from "@shared/models";
import { OrderItemRow } from "./OrderItemRow";

export interface OrderItemsCardProps {
  order: Order;
}

export function OrderItemsCard({
  order,
}: OrderItemsCardProps): React.ReactElement {
  const canEdit =
    order.status === "PENDING" || order.status === "ORDERED";

  return (
    <Paper sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6">明細項目</Typography>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 50 }} />
              <TableCell>商品名稱</TableCell>
              <TableCell>規格組合</TableCell>
              <TableCell align="right">數量</TableCell>
              <TableCell align="right">單價</TableCell>
              <TableCell align="right">小計</TableCell>
              <TableCell>供應商</TableCell>
              <TableCell align="right">採購成本</TableCell>
              <TableCell align="center">狀態</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <OrderItemRow
              orderItem={order}
              order={order}
              canEdit={canEdit}
            />
          </TableBody>
        </Table>
      </TableContainer>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mt: 2,
          pt: 2,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="h6">
          總金額：{formatCurrency(order.totalAmount)}
        </Typography>
      </Box>
    </Paper>
  );
}
