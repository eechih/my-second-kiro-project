import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

export interface OrderFormActionsProps {
  isSubmitting: boolean;
  onCancel: () => void;
}

export function OrderFormActions({
  isSubmitting,
  onCancel,
}: OrderFormActionsProps): React.ReactElement {
  return (
    <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
      <Button variant="outlined" onClick={onCancel}>
        取消
      </Button>
      <Button
        type="submit"
        variant="contained"
        disabled={isSubmitting}
        startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
      >
        建立訂單
      </Button>
    </Box>
  );
}
