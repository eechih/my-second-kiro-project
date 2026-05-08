import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { LineItem } from "@shared/models";
import { OrderLineItemTableRow } from "./OrderLineItemTableRow";

export interface OrderLineItemsTableProps {
  lineItems: LineItem[];
}

export function OrderLineItemsTable({
  lineItems,
}: OrderLineItemsTableProps): React.ReactElement {
  return (
    <TableRow>
      <TableCell sx={{ py: 0 }} colSpan={6}>
        <Box sx={{ mx: 2, my: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>商品名稱</TableCell>
                <TableCell>規格</TableCell>
                <TableCell align="right">數量</TableCell>
                <TableCell align="right">單價</TableCell>
                <TableCell align="right">小計</TableCell>
                <TableCell align="center">狀態</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lineItems.map((item) => (
                <OrderLineItemTableRow key={item.id} item={item} />
              ))}
            </TableBody>
          </Table>
        </Box>
      </TableCell>
    </TableRow>
  );
}
