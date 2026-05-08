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
  statusDisabled: boolean;
  searchSuppliers: (query: string) => Promise<SupplierOption[]>;
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
  statusDisabled,
  searchSuppliers,
  onSelectAll,
  onSelectRow,
  onEdit,
  onCellEdit,
}: ProductTableProps): React.ReactElement {
  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table sx={listTableBodyTextSx}>
          <TableHead>
            <TableRow>
              <TableCell>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onSelectAll}
                  size="small"
                />
              </TableCell>
              <TableCell>圖片</TableCell>
              <TableCell>商品名稱</TableCell>
              <TableCell align="right">單價</TableCell>
              <TableCell align="right">庫存數量</TableCell>
              <TableCell align="center">供應商</TableCell>
              <TableCell align="right">進貨成本</TableCell>
              <TableCell>建立日期</TableCell>
              <TableCell align="center">狀態</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {productIds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
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
                  statusDisabled={statusDisabled}
                  searchSuppliers={searchSuppliers}
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
