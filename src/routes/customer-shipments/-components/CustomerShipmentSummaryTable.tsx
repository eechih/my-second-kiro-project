export interface CustomerShipmentSummaryRow {
  customerId: string;
  customerName: string;
  latestReceivedAt?: string;
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

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "-";
  }

  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat("zh-TW", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffMonths / 12);
  return rtf.format(diffYears, "year");
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
              <TableCell>最近到貨時間</TableCell>
              <TableCell align="right">{itemCountLabel}</TableCell>
              <TableCell align="right">{orderCountLabel}</TableCell>
              <TableCell align="right">已完成訂單</TableCell>
              <TableCell align="right">總訂單</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">
                    目前沒有符合條件的客戶
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
                  <TableCell>{formatDateTime(summary.latestReceivedAt)}</TableCell>
                  <TableCell align="right">{summary.itemCount}</TableCell>
                  <TableCell align="right">{summary.orderCount}</TableCell>
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
