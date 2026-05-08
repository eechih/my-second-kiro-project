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
import type { Customer } from "@shared/models";
import {
  CustomerTableRow,
  type EditableCustomerField,
} from "./CustomerTableRow";

export interface CustomerTableProps {
  customerIds: string[];
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  isLoading: boolean;
  statusDisabled: boolean;
  onSelectAll: () => void;
  onSelectRow: (customerId: string) => void;
  onEdit: (customer: Customer) => void;
  onCellEdit: (
    customer: Customer,
    field: EditableCustomerField,
    value: string | boolean,
  ) => Promise<void>;
}

export function CustomerTable({
  customerIds,
  selectedIds,
  allSelected,
  someSelected,
  isLoading,
  statusDisabled,
  onSelectAll,
  onSelectRow,
  onEdit,
  onCellEdit,
}: CustomerTableProps): React.ReactElement {
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
              <TableCell>客戶資訊</TableCell>
              <TableCell>電話</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>地址</TableCell>
              <TableCell align="center">狀態</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customerIds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    目前沒有符合條件的客戶資料
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              customerIds.map((customerId) => (
                <CustomerTableRow
                  key={customerId}
                  customerId={customerId}
                  selected={selectedIds.has(customerId)}
                  statusDisabled={statusDisabled}
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

export type { EditableCustomerField };
