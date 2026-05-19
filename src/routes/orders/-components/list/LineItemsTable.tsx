import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import type { OrderItem } from "@shared/models";
import { LineItemRow } from "./LineItemRow";

export interface OrderItemsTableProps {
  items: OrderItem[];
  orderId: string;
}

export function LineItemsTable({
  items,
  orderId,
}: OrderItemsTableProps): React.ReactElement {
  return (
    <Box>
      <Table size="small">
        <TableBody>
          {items.map((item) => (
            <LineItemRow
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
