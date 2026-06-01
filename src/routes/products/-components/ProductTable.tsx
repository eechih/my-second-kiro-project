import { listTableBodyTextSx } from "@/components/listTableStyles";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { Product } from "@shared/models";
import {
  ProductTableRow,
  type EditableProductField,
  type SupplierOption,
} from "./ProductTableRow";

export interface ProductTableProps {
  productIds: string[];
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  isLoading: boolean;
  supplierOptions: SupplierOption[];
  onSelectAll: () => void;
  onSelectRow: (productId: string) => void;
  onEdit: (product: Product) => void;
  onCellEdit: (
    product: Product,
    field: EditableProductField,
    value: string | number | boolean | null,
  ) => Promise<void>;
}

export function ProductTable({
  productIds,
  selectedIds,
  allSelected,
  someSelected,
  isLoading,
  supplierOptions,
  onSelectAll,
  onSelectRow,
  onEdit,
  onCellEdit,
}: ProductTableProps): React.ReactElement {
  const tableMinWidth = 1320;
  const checkboxCellSx = {
    width: 40,
    px: 0.5,
    whiteSpace: "nowrap",
  } as const;
  const sequenceCellSx = {
    width: 64,
    px: 1,
    whiteSpace: "nowrap",
  } as const;
  const imageCellSx = {
    width: 64,
    px: 1,
    whiteSpace: "nowrap",
  } as const;
  const nameCellSx = {
    minWidth: 256,
  } as const;
  const preorderCloseCellSx = {
    width: 128,
    px: 1,
    whiteSpace: "nowrap",
  } as const;
  const priceCellSx = {
    width: 128,
    px: 1,
    whiteSpace: "nowrap",
  } as const;
  const costCellSx = {
    width: 128,
    px: 1,
    whiteSpace: "nowrap",
  } as const;
  const stockCellSx = {
    width: 128,
    px: 1,
    whiteSpace: "nowrap",
  } as const;
  const supplierCellSx = {
    width: 128,
    px: 1,
    whiteSpace: "nowrap",
  } as const;
  const statusCellSx = {
    width: 128,
    px: 1,
    whiteSpace: "nowrap",
  } as const;
  const actionCellSx = {
    width: 128,
    px: 0.5,
    whiteSpace: "nowrap",
  } as const;

  return (
    <TableContainer component={Paper} sx={{ mt: 2, overflowX: "auto" }}>
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table
          sx={{
            ...listTableBodyTextSx,
            tableLayout: "fixed",
            minWidth: tableMinWidth,
            width: "100%",
          }}
        >
          <colgroup>
            <col style={{ width: checkboxCellSx.width }} />
            <col style={{ width: sequenceCellSx.width }} />
            <col style={{ width: imageCellSx.width }} />
            <col />
            <col style={{ width: priceCellSx.width }} />
            <col style={{ width: stockCellSx.width }} />
            <col style={{ width: supplierCellSx.width }} />
            <col style={{ width: costCellSx.width }} />
            <col style={{ width: preorderCloseCellSx.width }} />
            <col style={{ width: statusCellSx.width }} />
            <col style={{ width: actionCellSx.width }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={checkboxCellSx}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onSelectAll}
                  size="small"
                />
              </TableCell>
              <TableCell align="left" sx={sequenceCellSx}>
                編號
              </TableCell>
              <TableCell align="center" sx={imageCellSx}>
                圖片
              </TableCell>
              <TableCell sx={nameCellSx}>商品名稱</TableCell>
              <TableCell align="right" sx={priceCellSx}>
                單價
              </TableCell>
              <TableCell align="right" sx={stockCellSx}>
                庫存數量
              </TableCell>
              <TableCell align="center" sx={supplierCellSx}>
                供應商
              </TableCell>
              <TableCell align="right" sx={costCellSx}>
                進貨成本
              </TableCell>
              <TableCell align="center" sx={preorderCloseCellSx}>
                預購截止日
              </TableCell>
              <TableCell align="center" sx={statusCellSx}>
                預購狀態
              </TableCell>
              <TableCell align="center" sx={actionCellSx}>
                操作
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {productIds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    目前沒有符合條件的商品資料
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              productIds.map((productId) => (
                <ProductTableRow
                  key={productId}
                  productId={productId}
                  selected={selectedIds.has(productId)}
                  supplierOptions={supplierOptions}
                  onSelect={onSelectRow}
                  onEdit={onEdit}
                  onCellEdit={onCellEdit}
                />
              ))
            )}
          </TableBody>
        </Table>
      )}
    </TableContainer>
  );
}

export type { EditableProductField, SupplierOption };
