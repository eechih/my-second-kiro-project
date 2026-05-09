import CallSplitIcon from "@mui/icons-material/CallSplit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

export interface SplitActionsProps {
  isPending: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SplitActions({
  isPending,
  disabled,
  onConfirm,
  onCancel,
}: SplitActionsProps): React.ReactElement {
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
