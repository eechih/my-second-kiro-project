import CallSplitIcon from "@mui/icons-material/CallSplit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

export interface OrderSplitActionsProps {
  isPending: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function OrderSplitActions({
  isPending,
  disabled,
  onConfirm,
  onCancel,
}: OrderSplitActionsProps): React.ReactElement {
  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      <Button
        variant="contained"
        startIcon={
          isPending ? <CircularProgress size={20} color="inherit" /> : <CallSplitIcon />
        }
        onClick={onConfirm}
        disabled={disabled}
      >
        {isPending ? "分拆中..." : "確認分拆"}
      </Button>
      <Button variant="outlined" onClick={onCancel}>
        取消
      </Button>
    </Box>
  );
}
