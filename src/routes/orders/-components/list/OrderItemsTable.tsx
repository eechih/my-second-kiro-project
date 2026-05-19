import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import type { OrderItem } from "@shared/models";
import { OrderItemRow } from "./OrderItemRow";

export interface OrderItemsTableProps {
  items: OrderItem[];
  orderId: string;
}

export function OrderItemsTable({
  items,
  orderId,
}: OrderItemsTableProps): React.ReactElement {
  return (
    <Box>
      <Table size="small">
        <TableBody>
          {items.map((item) => (
            <OrderItemRow
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
