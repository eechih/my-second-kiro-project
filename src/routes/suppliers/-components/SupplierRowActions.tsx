import { Box, IconButton, Tooltip } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { Supplier } from "../../../../shared/models/supplier";

export interface SupplierRowActionsProps {
  supplier: Supplier;
  onView: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onToggleActive: (supplier: Supplier) => void;
}

/**
 * 供應商行操作按鈕元件
 * 顯示檢視、編輯、啟用/停用三個 IconButton
 * 需求：4.1, 4.6
 */
export function SupplierRowActions({
  supplier,
  onView,
  onEdit,
  onToggleActive,
}: SupplierRowActionsProps): React.ReactElement {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Tooltip title="檢視">
        <IconButton size="small" onClick={() => onView(supplier)}>
          <VisibilityIcon fontSize="small" />
        </IconButton>
      </Tooltip>
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
