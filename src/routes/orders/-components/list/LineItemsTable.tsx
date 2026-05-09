import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import type { LineItem } from "@shared/models";
import { LineItemRow } from "./LineItemRow";

export interface LineItemsTableProps {
  lineItems: LineItem[];
  orderId: string;
}

export function LineItemsTable({
  lineItems,
  orderId,
}: LineItemsTableProps): React.ReactElement {
  return (
    <Box>
      <Table size="small">
        <TableBody>
          {lineItems.map((item) => (
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
