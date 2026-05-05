import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: "error" | "primary" | "secondary" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 確認對話框元件，用於刪除、取消、停用等需要使用者二次確認的操作。
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "確認",
  cancelLabel = "取消",
  confirmColor = "error",
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit">
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} color={confirmColor} variant="contained">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
