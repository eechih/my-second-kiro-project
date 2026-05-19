import { formatCurrency } from "@/lib/currency";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { Order } from "@shared/models";

export interface SplitAllocationTableProps {
  order: Order;
  allocations: Map<string, number>;
  maxNewOrders: number;
  onAllocationChange: (orderItemId: string, targetIndex: number) => void;
}

export function SplitAllocationTable({
  order,
  allocations,
  maxNewOrders,
  onAllocationChange,
}: SplitAllocationTableProps): React.ReactElement {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        明細項目分配
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        為每個明細項目指定要分配到的新訂單。至少需要分配到兩筆不同的新訂單。
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>商品名稱</TableCell>
              <TableCell>規格</TableCell>
              <TableCell align="right">數量</TableCell>
              <TableCell align="right">單價</TableCell>
              <TableCell align="right">小計</TableCell>
              <TableCell sx={{ minWidth: 140 }}>分配至</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {order.lineItems.map((lineItem) => (
              <TableRow key={lineItem.id}>
                <TableCell>{lineItem.productName}</TableCell>
                <TableCell>{lineItem.variantLabel ?? "-"}</TableCell>
                <TableCell align="right">{lineItem.quantity}</TableCell>
                <TableCell align="right">
                  {formatCurrency(lineItem.unitPrice)}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(lineItem.subtotal)}
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={allocations.get(lineItem.id) ?? ""}
                      onChange={(event) =>
                        onAllocationChange(
                          lineItem.id,
                          Number(event.target.value),
                        )
                      }
                      displayEmpty
                    >
                      <MenuItem value="" disabled>
                        選取
                      </MenuItem>
                      {Array.from(
                        {
                          length: Math.min(
                            maxNewOrders,
                            order.lineItems.length,
                          ),
                        },
                        (_, index) => (
                          <MenuItem key={index} value={index}>
                            新訂單 {index + 1}
                          </MenuItem>
                        ),
                      )}
                    </Select>
                  </FormControl>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
