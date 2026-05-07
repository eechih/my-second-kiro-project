import { Box, IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { Customer } from "../../../../shared/models/customer";

export interface RowActionsProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onToggleActive: (customer: Customer) => void;
}

/**
 * 行操作按鈕元件
 * 顯示編輯、啟用/停用 IconButton
 * 需求：4.1, 4.6
 */
export function RowActions({
  customer,
  onEdit,
  onToggleActive,
}: RowActionsProps): React.ReactElement {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Tooltip title="編輯">
        <IconButton size="small" onClick={() => onEdit(customer)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={customer.isActive ? "停用" : "啟用"}>
        <IconButton
          size="small"
          color={customer.isActive ? "warning" : "success"}
          onClick={() => onToggleActive(customer)}
        >
          {customer.isActive ? (
            <BlockIcon fontSize="small" />
          ) : (
            <CheckCircleIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
