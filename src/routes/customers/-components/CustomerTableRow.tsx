import {
  EditableStatusCell,
  EditableTextCell,
} from "@/components/EditableCell";
import { useCustomer } from "@/hooks/useCustomers";
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
import type { Customer } from "@shared/models";

export type EditableCustomerField =
  | "name"
  | "phone"
  | "email"
  | "address"
  | "isActive";

export interface CustomerTableRowProps {
  customerId: string;
  selected: boolean;
  statusDisabled: boolean;
  onSelect: (customerId: string) => void;
  onEdit: (customer: Customer) => void;
  onCellEdit: (
    customer: Customer,
    field: EditableCustomerField,
    value: string | boolean,
  ) => Promise<void>;
}

export function CustomerTableRow({
  customerId,
  selected,
  statusDisabled,
  onSelect,
  onEdit,
  onCellEdit,
}: CustomerTableRowProps): React.ReactElement {
  const { data: customer, isLoading, error } = useCustomer(customerId);

  if (isLoading) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(customerId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={6}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography color="text.secondary">載入客戶資料中...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  if (error || !customer) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(customerId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={6}>
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢客戶失敗"}
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
          onChange={() => onSelect(customer.id)}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: getAvatarColor(customer.name),
              width: 36,
              height: 36,
              fontSize: "0.875rem",
            }}
          >
            {getAvatarLetter(customer.name)}
          </Avatar>
          <Box>
            <EditableTextCell
              value={customer.name}
              onCommit={(value) => onCellEdit(customer, "name", value)}
            />
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={customer.phone}
          onCommit={(value) => onCellEdit(customer, "phone", value)}
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={customer.email}
          onCommit={(value) => onCellEdit(customer, "email", value)}
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={customer.address}
          onCommit={(value) => onCellEdit(customer, "address", value)}
        />
      </TableCell>
      <TableCell align="center">
        <EditableStatusCell
          isActive={customer.isActive}
          disabled={statusDisabled}
          onCommit={(isActive) => onCellEdit(customer, "isActive", isActive)}
        />
      </TableCell>
      <TableCell align="center">
        <Tooltip title="編輯">
          <IconButton size="small" onClick={() => onEdit(customer)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}
