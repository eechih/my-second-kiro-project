import { listTableBodyTextSx } from "@/components/listTableStyles";
import { useProductThumbnailUrls } from "@/hooks/useProductImages";
import type { ProductPurchaseSummary } from "@/hooks/useProductPurchases";
import { formatCurrency } from "@/lib/currency";
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
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import {
  ORDER_ITEM_STATUS_LABEL,
  type OrderFulfillmentStatus,
} from "@shared/models";
import { useMemo, useState } from "react";

type SortKey = "sku" | "supplier" | "pending" | "ordered";
type SortDirection = "asc" | "desc";

const PRODUCT_PURCHASE_STATUS_COLUMNS: readonly OrderFulfillmentStatus[] = [
  "PENDING",
  "ORDERED",
  "RECEIVED",
];

function compareSummaries(
  a: ProductPurchaseSummary,
  b: ProductPurchaseSummary,
  sortKey: SortKey,
  direction: SortDirection,
): number {
  let result = 0;

  switch (sortKey) {
    case "sku":
      result = (a.productSku ?? "").localeCompare(
        b.productSku ?? "",
        "zh-Hant",
      );
      break;
    case "supplier":
      result = (a.supplierName ?? "").localeCompare(
        b.supplierName ?? "",
        "zh-Hant",
      );
      break;
    case "pending":
      result =
        (a.statusQuantities["PENDING"] ?? 0) -
        (b.statusQuantities["PENDING"] ?? 0);
      break;
    case "ordered":
      result =
        (a.statusQuantities["ORDERED"] ?? 0) -
        (b.statusQuantities["ORDERED"] ?? 0);
      break;
  }

  return direction === "desc" ? -result : result;
}

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
  const [sortKey, setSortKey] = useState<SortKey>("pending");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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

  const sortedSummaries = useMemo(
    () =>
      [...summaries].sort((a, b) =>
        compareSummaries(a, b, sortKey, sortDirection),
      ),
    [summaries, sortKey, sortDirection],
  );

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "sku" || key === "supplier" ? "asc" : "desc");
    }
  };

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
                <TableCell>
                  <TableSortLabel
                    active={sortKey === "sku"}
                    direction={sortKey === "sku" ? sortDirection : "asc"}
                    onClick={() => handleSort("sku")}
                  >
                    商品
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ width: 96 }}>
                  售價
                </TableCell>
                <TableCell align="right" sx={{ width: 96 }}>
                  成本
                </TableCell>
                <TableCell align="center" sx={{ width: 120 }}>
                  <TableSortLabel
                    active={sortKey === "supplier"}
                    direction={sortKey === "supplier" ? sortDirection : "asc"}
                    onClick={() => handleSort("supplier")}
                  >
                    供應商
                  </TableSortLabel>
                </TableCell>
                {PRODUCT_PURCHASE_STATUS_COLUMNS.map((status) => {
                  const isSortable =
                    status === "PENDING" || status === "ORDERED";
                  const key =
                    status === "PENDING"
                      ? "pending"
                      : status === "ORDERED"
                        ? "ordered"
                        : null;

                  return (
                    <TableCell key={status} align="right" sx={{ width: 80 }}>
                      {isSortable && key ? (
                        <TableSortLabel
                          active={sortKey === key}
                          direction={sortKey === key ? sortDirection : "desc"}
                          onClick={() => handleSort(key)}
                        >
                          {ORDER_ITEM_STATUS_LABEL[status] ?? status}
                        </TableSortLabel>
                      ) : (
                        (ORDER_ITEM_STATUS_LABEL[status] ?? status)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedSummaries.map((summary) => {
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
                            {summary.productSku || "—"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(summary.price)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(summary.cost)}
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        color: summary.supplierName
                          ? "text.primary"
                          : "text.secondary",
                      }}
                    >
                      {summary.supplierName || "—"}
                    </TableCell>
                    {PRODUCT_PURCHASE_STATUS_COLUMNS.map((status) => {
                      const value = summary.statusQuantities[status] ?? 0;

                      return (
                        <TableCell key={status} align="right">
                          {status === "PENDING" ? (
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
