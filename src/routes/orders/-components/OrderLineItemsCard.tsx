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
import { OrderLineItemDetailRow } from "./OrderLineItemDetailRow";

export interface OrderLineItemsCardProps {
  order: Order;
}

export function OrderLineItemsCard({
  order,
}: OrderLineItemsCardProps): React.ReactElement {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        明細項目
      </Typography>
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
            {order.lineItems.map((lineItem) => (
              <OrderLineItemDetailRow
                key={lineItem.id}
                lineItem={lineItem}
                order={order}
              />
            ))}
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
          總金額：{order.totalAmount.toLocaleString()}
        </Typography>
      </Box>
    </Paper>
  );
}
