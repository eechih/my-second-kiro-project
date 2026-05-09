import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { LineItem } from "@shared/models";

export interface SplitPreviewGroup {
  index: number;
  lineItems: LineItem[];
  totalAmount: number;
}

export interface SplitPreviewProps {
  groups: SplitPreviewGroup[];
  newOrderCount: number;
}

export function SplitPreview({
  groups,
  newOrderCount,
}: SplitPreviewProps): React.ReactElement | null {
  if (groups.length < 2) return null;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        分拆預覽
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        將產生 {newOrderCount} 筆新訂單，原訂單將被取消。
      </Alert>

      {groups.map((group, index) => (
        <Box key={group.index}>
          {index > 0 && <Divider sx={{ my: 2 }} />}
          <Box sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              新訂單 {group.index + 1}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {group.lineItems.length} 項明細，總金額 $
              {group.totalAmount.toLocaleString()}
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>商品名稱</TableCell>
                  <TableCell>規格</TableCell>
                  <TableCell align="right">數量</TableCell>
                  <TableCell align="right">小計</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.lineItems.map((lineItem) => (
                  <TableRow key={lineItem.id}>
                    <TableCell>{lineItem.productName}</TableCell>
                    <TableCell>{lineItem.variantLabel ?? "-"}</TableCell>
                    <TableCell align="right">{lineItem.quantity}</TableCell>
                    <TableCell align="right">
                      ${lineItem.subtotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}
    </Paper>
  );
}
