import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import type { LineItem } from "@shared/models";
import { OrderLineItemTableRow } from "./OrderLineItemTableRow";

export interface OrderLineItemsTableProps {
  lineItems: LineItem[];
  orderId: string;
}

export function OrderLineItemsTable({
  lineItems,
  orderId,
}: OrderLineItemsTableProps): React.ReactElement {
  return (
    <Box>
      <Table size="small">
        <TableBody>
          {lineItems.map((item) => (
            <OrderLineItemTableRow
              key={item.id}
              item={item}
              orderId={orderId}
            />
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
