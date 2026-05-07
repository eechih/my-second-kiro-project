import { Box, IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { Customer } from "../../../../shared/models/customer";

export interface RowActionsProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
}

/**
 * 行操作按鈕元件
 * 顯示編輯 IconButton
 * 需求：4.1
 */
export function RowActions({
  customer,
  onEdit,
}: RowActionsProps): React.ReactElement {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Tooltip title="編輯">
        <IconButton size="small" onClick={() => onEdit(customer)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
