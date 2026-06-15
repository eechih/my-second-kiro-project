export interface CustomerShipmentSummaryRow {
  customerId: string;
  customerName: string;
  totalOrderCount: number;
  completedOrderCount: number;
  orderCount: number;
  itemCount: number;
}

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

export interface CustomerShipmentSummaryTableProps {
  summaries: readonly CustomerShipmentSummaryRow[];
  isLoading: boolean;
  orderCountLabel: string;
  itemCountLabel: string;
  onSelectCustomer: (customerId: string) => void;
}

export function CustomerShipmentSummaryTable({
  summaries,
  isLoading,
  orderCountLabel,
  itemCountLabel,
  onSelectCustomer,
}: CustomerShipmentSummaryTableProps): React.ReactElement {
  return (
    <TableContainer component={Paper}>
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>客戶名稱</TableCell>
              <TableCell align="right">{orderCountLabel}</TableCell>
              <TableCell align="right">{itemCountLabel}</TableCell>
              <TableCell align="right">已完成訂單數量</TableCell>
              <TableCell align="right">總訂單數量</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">
                    目前沒有待出貨的客戶
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              summaries.map((summary) => (
                <TableRow
                  key={summary.customerId}
                  hover
                  onClick={() => onSelectCustomer(summary.customerId)}
                  sx={{
                    cursor: "pointer",
                    "&:last-child td, &:last-child th": { borderBottom: 0 },
                  }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>
                    {summary.customerName}
                  </TableCell>
                  <TableCell align="right">{summary.orderCount}</TableCell>
                  <TableCell align="right">{summary.itemCount}</TableCell>
                  <TableCell align="right">
                    {summary.completedOrderCount}
                  </TableCell>
                  <TableCell align="right">{summary.totalOrderCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </TableContainer>
  );
}
