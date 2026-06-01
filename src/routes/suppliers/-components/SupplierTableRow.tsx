import {
  EditableStatusCell,
  EditableTextCell,
} from "@/components/EditableCell";
import { useSupplier } from "@/hooks/useSuppliers";
import { getAvatarColor, getAvatarLetter } from "@/lib/avatar-utils";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import type { Supplier } from "@shared/models";

export type EditableSupplierField =
  | "name"
  | "phone"
  | "email"
  | "address"
  | "isActive";

export interface SupplierTableRowProps {
  supplierId: string;
  selected: boolean;
  statusDisabled: boolean;
  onSelect: (supplierId: string) => void;
  onEdit: (supplier: Supplier) => void;
  onCellEdit: (
    supplier: Supplier,
    field: EditableSupplierField,
    value: string | boolean,
  ) => Promise<void>;
}

export function SupplierTableRow({
  supplierId,
  selected,
  statusDisabled,
  onSelect,
  onEdit,
  onCellEdit,
}: SupplierTableRowProps): React.ReactElement {
  const { data: supplier, isLoading, error } = useSupplier(supplierId);

  if (isLoading) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(supplierId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={6}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography color="text.secondary">載入供應商資料中...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  if (error || !supplier) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(supplierId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={6}>
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢供應商失敗"}
          </Alert>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow selected={selected} hover>
      <TableCell>
        <Checkbox
          checked={selected}
          onChange={() => onSelect(supplier.id)}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: getAvatarColor(supplier.name),
              width: 36,
              height: 36,
              fontSize: "0.875rem",
            }}
          >
            {getAvatarLetter(supplier.name)}
          </Avatar>
          <Box>
            <EditableTextCell
              value={supplier.name}
              onCommit={(value) => onCellEdit(supplier, "name", value)}
            />
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={supplier.phone}
          onCommit={(value) => onCellEdit(supplier, "phone", value)}
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={supplier.email}
          onCommit={(value) => onCellEdit(supplier, "email", value)}
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={supplier.address}
          onCommit={(value) => onCellEdit(supplier, "address", value)}
        />
      </TableCell>
      <TableCell align="center">
        <EditableStatusCell
          isActive={supplier.isActive}
          disabled={statusDisabled}
          onCommit={(isActive) => onCellEdit(supplier, "isActive", isActive)}
        />
      </TableCell>
      <TableCell align="center">
        <Tooltip title="編輯">
          <IconButton size="small" onClick={() => onEdit(supplier)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}
