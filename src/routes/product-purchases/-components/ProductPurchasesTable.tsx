import { listTableBodyTextSx } from "@/components/listTableStyles";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { ProductPurchasesRow } from "./ProductPurchasesRow";
import type { ProductPurchaseStatusFilter } from "./ProductPurchasesToolbar";

const PRODUCT_PURCHASE_COLUMNS = [
  { key: "sequence", label: "編號", width: 72, align: undefined },
  { key: "name", label: "商品名稱", width: 320, align: undefined },
  { key: "price", label: "單價", width: 96, align: "right" as const },
  { key: "cost", label: "預設成本", width: 96, align: "right" as const },
  { key: "stock", label: "庫存", width: 84, align: "right" as const },
  { key: "count", label: "作業筆數", width: 88, align: "center" as const },
  { key: "pending", label: "待處理", width: 84, align: "center" as const },
  { key: "ordered", label: "已訂貨", width: 84, align: "center" as const },
  { key: "received", label: "已到貨", width: 84, align: "center" as const },
  { key: "shipped", label: "已出貨", width: 84, align: "center" as const },
  { key: "actions", label: "操作", width: 180, align: "center" as const },
] as const;

export interface ProductPurchasesTableProps {
  productIds: string[];
  isLoading: boolean;
  statusFilter: ProductPurchaseStatusFilter;
}

export function ProductPurchasesTable({
  productIds,
  isLoading,
  statusFilter,
}: ProductPurchasesTableProps): React.ReactElement {
  return (
    <Box sx={{ mt: 2 }}>
      {isLoading ? (
        <Paper sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Paper>
      ) : productIds.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            目前沒有符合條件的商品資料
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
            </Table>
          </TableContainer>

          {productIds.map((productId) => (
            <ProductPurchasesRow
              key={productId}
              productId={productId}
              statusFilter={statusFilter}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
