import { Box, IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { Supplier } from "@shared/models";

export interface SupplierRowActionsProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onToggleActive: (supplier: Supplier) => void;
}

/**
 * 供應商行操作按鈕元件
 * 顯示編輯、啟用/停用 IconButton
 * 需求：4.1, 4.6
 */
export function SupplierRowActions({
  supplier,
  onEdit,
  onToggleActive,
}: SupplierRowActionsProps): React.ReactElement {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Tooltip title="編輯">
        <IconButton size="small" onClick={() => onEdit(supplier)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={supplier.isActive ? "停用" : "啟用"}>
        <IconButton
          size="small"
          color={supplier.isActive ? "warning" : "success"}
          onClick={() => onToggleActive(supplier)}
        >
          {supplier.isActive ? (
            <BlockIcon fontSize="small" />
          ) : (
            <CheckCircleIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
