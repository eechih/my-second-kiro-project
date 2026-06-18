import { listTableBodyTextSx } from "@/components/listTableStyles";
import { useProductThumbnailUrls } from "@/hooks/useProductImages";
import type { ProductPurchaseSummary } from "@/hooks/useProductPurchases";
import { formatCurrency } from "@/lib/currency";
import Box from "@mui/material/Box";
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
import Chip from "@mui/material/Chip";
import { ORDER_ITEM_STATUSES, ORDER_ITEM_STATUS_LABEL } from "@shared/models";

type ProductPurchaseColumn = {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
};

const PRODUCT_PURCHASE_COLUMNS: readonly ProductPurchaseColumn[] = [
  { key: "name", label: "商品", width: undefined, align: undefined },
  { key: "supplier", label: "供應商", width: 96, align: undefined },
  { key: "price", label: "售價", width: 96, align: "right" },
  { key: "cost", label: "成本", width: 96, align: "right" },
  {
    key: "pending",
    label: ORDER_ITEM_STATUS_LABEL.pending,
    width: 96,
    align: "right",
  },
  {
    key: "ordered",
    label: ORDER_ITEM_STATUS_LABEL.ordered,
    width: 96,
    align: "right",
  },
  {
    key: "received",
    label: ORDER_ITEM_STATUS_LABEL.received,
    width: 96,
    align: "right",
  },
  {
    key: "shipped",
    label: ORDER_ITEM_STATUS_LABEL.shipped,
    width: 96,
    align: "right",
  },
  {
    key: "out_of_stock",
    label: ORDER_ITEM_STATUS_LABEL.out_of_stock,
    width: 96,
    align: "right",
  },
  {
    key: "total",
    label: "總計",
    width: 96,
    align: "right",
  },
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
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ alignItems: "center", minWidth: 0 }}
                      >
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
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 1,
                              border: "1px dashed",
                              borderColor: "divider",
                              color: "text.disabled",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            —
                          </Box>
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {summary.productName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            點選查看作業明細
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell
                      sx={{
                        color: summary.supplierName
                          ? "text.primary"
                          : "text.secondary",
                      }}
                    >
                      {summary.supplierName || "—"}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(summary.price)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(summary.cost)}
                    </TableCell>
                    {ORDER_ITEM_STATUSES.map((status) => {
                      const value = summary.statusQuantities[status];

                      return (
                        <TableCell key={status} align="right">
                          {status === "pending" ? (
                            <Chip
                              label={value}
                              color={value > 0 ? "warning" : "default"}
                              size="small"
                              sx={{
                                minWidth: 52,
                                fontWeight: 700,
                                justifyContent: "center",
                              }}
                            />
                          ) : (
                            value
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="right">{summary.totalQuantity}</TableCell>
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
