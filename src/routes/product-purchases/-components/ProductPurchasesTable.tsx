import { listTableBodyTextSx } from "@/components/listTableStyles";
import { useProductThumbnailUrls } from "@/hooks/useProductImages";
import type { ProductPurchaseSummary } from "@/hooks/useProductPurchases";
import { formatCurrency } from "@/lib/currency";
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

type ProductPurchaseColumn = {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
};

const PRODUCT_PURCHASE_COLUMNS: readonly ProductPurchaseColumn[] = [
  { key: "image", label: "圖片", width: 84, align: "center" },
  { key: "name", label: "商品名稱", width: undefined, align: undefined },
  { key: "supplier", label: "供應商", width: 180, align: undefined },
  { key: "price", label: "售價", width: 108, align: "right" },
  { key: "cost", label: "成本", width: 108, align: "right" },
  {
    key: "total",
    label: "訂單品項總數量",
    width: 180,
    align: "right",
  },
  ...ORDER_ITEM_STATUSES.map((status) => ({
    key: status,
    label: `${ORDER_ITEM_STATUS_LABEL[status]}數量`,
    width: 140,
    align: "right",
  })),
];

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
  const imageKeys = Array.from(
    new Set(
      summaries
        .map((summary) => summary.productImageUrl)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const { data: thumbnailUrls = [] } = useProductThumbnailUrls(imageKeys);
  const thumbnailUrlMap = new Map(
    imageKeys.map((key, index) => [key, thumbnailUrls[index] ?? undefined]),
  );

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
              {summaries.map((summary) => {
                const thumbnailUrl = summary.productImageUrl
                  ? thumbnailUrlMap.get(summary.productImageUrl)
                  : undefined;

                return (
                  <TableRow
                    key={summary.productId}
                    hover
                    onClick={() => onSelectProduct(summary)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell align="center">
                      {thumbnailUrl ? (
                        <Box
                          component="img"
                          src={thumbnailUrl}
                          alt={summary.productName}
                          sx={{
                            width: 48,
                            height: 48,
                            objectFit: "cover",
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: "divider",
                            display: "block",
                            mx: "auto",
                          }}
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {summary.productName}
                    </TableCell>
                    <TableCell>{summary.supplierName || "—"}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(summary.price)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(summary.cost)}
                    </TableCell>
                    <TableCell align="right">{summary.totalQuantity}</TableCell>
                    {ORDER_ITEM_STATUSES.map((status) => (
                      <TableCell key={status} align="right">
                        {summary.statusQuantities[status]}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
