import { listTableBodyTextSx } from "@/components/listTableStyles";
import type { SupplierReceivingSummary } from "@/hooks/useSupplierReceivings";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

type SupplierReceivingColumn = {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
};

const SUPPLIER_RECEIVING_COLUMNS: readonly SupplierReceivingColumn[] = [
  { key: "supplier", label: "供應商", width: undefined, align: undefined },
  { key: "ordered", label: "待入庫", width: 120, align: "right" },
  { key: "received", label: "已入庫", width: 120, align: "right" },
  { key: "total", label: "總計", width: 120, align: "right" },
];

export interface SupplierReceivingsTableProps {
  summaries: SupplierReceivingSummary[];
  isLoading: boolean;
  onSelectSupplier: (summary: SupplierReceivingSummary) => void;
}

export function SupplierReceivingsTable({
  summaries,
  isLoading,
  onSelectSupplier,
}: SupplierReceivingsTableProps): React.ReactElement {
  return (
    <Box sx={{ mt: 2 }}>
      {isLoading ? (
        <Paper sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Paper>
      ) : summaries.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有符合條件的供應商入庫資料
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={listTableBodyTextSx}>
            <TableHead>
              <TableRow>
                {SUPPLIER_RECEIVING_COLUMNS.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align}
                    sx={{ width: column.width }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {summaries.map((summary) => (
                <TableRow
                  key={summary.supplierName}
                  hover
                  onClick={() => onSelectSupplier(summary)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>
                    <Stack spacing={0.25}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {summary.supplierName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        點選查看入庫明細
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={summary.orderedQuantity}
                      color={summary.orderedQuantity > 0 ? "warning" : "default"}
                      size="small"
                      sx={{
                        minWidth: 52,
                        fontWeight: 700,
                        justifyContent: "center",
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">{summary.receivedQuantity}</TableCell>
                  <TableCell align="right">{summary.totalQuantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
