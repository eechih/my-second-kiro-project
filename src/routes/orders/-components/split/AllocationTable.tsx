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
  onAllocationChange: (orderId: string, targetIndex: number) => void;
}

/**
 * @deprecated 訂單分拆功能已移除，此元件僅保留向下相容。
 */
export function SplitAllocationTable({
  order,
  allocations,
  maxNewOrders,
  onAllocationChange,
}: SplitAllocationTableProps): React.ReactElement {
  const variantLabel =
    order.selectedOptionsSnapshot
      ?.map((opt) => opt.valueName)
      .join(" / ") || null;

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
            <TableRow>
              <TableCell>{order.productNameSnapshot}</TableCell>
              <TableCell>{variantLabel ?? "-"}</TableCell>
              <TableCell align="right">{order.quantity}</TableCell>
              <TableCell align="right">
                {formatCurrency(order.unitPriceSnapshot)}
              </TableCell>
              <TableCell align="right">
                {formatCurrency(order.subtotalAmount)}
              </TableCell>
              <TableCell>
                <FormControl size="small" fullWidth>
                  <Select
                    value={allocations.get(order.id) ?? ""}
                    onChange={(event) =>
                      onAllocationChange(
                        order.id,
                        Number(event.target.value),
                      )
                    }
                    displayEmpty
                  >
                    <MenuItem value="" disabled>
                      選取
                    </MenuItem>
                    {Array.from(
                      { length: maxNewOrders },
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
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
