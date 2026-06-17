import { listTableBodyTextSx } from "@/components/listTableStyles";
import type { ProductPurchaseSummary } from "@/hooks/useProductPurchases";
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
import { ORDER_ITEM_STATUSES, ORDER_ITEM_STATUS_LABEL } from "@shared/models";

const PRODUCT_PURCHASE_COLUMNS = [
  { key: "name", label: "商品名稱", width: undefined, align: undefined },
  {
    key: "total",
    label: "訂單品項總數量",
    width: 180,
    align: "right" as const,
  },
  ...ORDER_ITEM_STATUSES.map((status) => ({
    key: status,
    label: `${ORDER_ITEM_STATUS_LABEL[status]}數量`,
    width: 140,
    align: "right" as const,
  })),
] as const;

export interface ProductPurchasesTableProps {
  summaries: ProductPurchaseSummary[];
  isLoading: boolean;
  onSelectProduct: (summary: ProductPurchaseSummary) => void;
}

export function ProductPurchasesTable({
  summaries,
  isLoading,
  onSelectProduct,
}: ProductPurchasesTableProps): React.ReactElement {
  return (
    <Box sx={{ mt: 2 }}>
      {isLoading ? (
        <Paper sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Paper>
      ) : summaries.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有符合條件的單品採購資料
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={listTableBodyTextSx}>
            <TableHead>
              <TableRow>
                {PRODUCT_PURCHASE_COLUMNS.map((column) => (
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
                  key={summary.productId}
                  hover
                  onClick={() => onSelectProduct(summary)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>
                    {summary.productName}
                  </TableCell>
                  <TableCell align="right">{summary.totalQuantity}</TableCell>
                  {ORDER_ITEM_STATUSES.map((status) => (
                    <TableCell key={status} align="right">
                      {summary.statusQuantities[status]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
