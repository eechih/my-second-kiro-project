import type { PendingShipmentCustomerSummary } from "@/hooks/useCustomerShipments";
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
  summaries: readonly PendingShipmentCustomerSummary[];
  isLoading: boolean;
  onSelectCustomer: (customerId: string) => void;
}

export function CustomerShipmentSummaryTable({
  summaries,
  isLoading,
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
              <TableCell align="right">待出貨訂單數量</TableCell>
              <TableCell align="right">待出貨品項數量</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 5 }}>
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
                  <TableCell align="right">
                    {summary.pendingOrderCount}
                  </TableCell>
                  <TableCell align="right">
                    {summary.pendingItemCount}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </TableContainer>
  );
}

