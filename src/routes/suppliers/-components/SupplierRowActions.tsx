import { Box, IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { Supplier } from "@shared/models";

export interface SupplierRowActionsProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
}

/**
 * 供應商行操作按鈕元件
 * 顯示編輯 IconButton
 * 需求：4.1
 */
export function SupplierRowActions({
  supplier,
  onEdit,
}: SupplierRowActionsProps): React.ReactElement {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Tooltip title="編輯">
        <IconButton size="small" onClick={() => onEdit(supplier)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
