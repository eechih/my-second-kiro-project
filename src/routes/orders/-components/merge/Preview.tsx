import { formatCurrency } from "@/lib/currency";
import MergeIcon from "@mui/icons-material/CallMerge";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export interface MergePreviewProps {
  selectedOrderCount: number;
  totalAmount: number;
  lineItemCount: number;
  isPending: boolean;
  onMerge: () => void;
}

export function MergePreview({
  selectedOrderCount,
  totalAmount,
  lineItemCount,
  isPending,
  onMerge,
}: MergePreviewProps): React.ReactElement | null {
  if (selectedOrderCount < 2) return null;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        合併預覽
      </Typography>
      <Box sx={{ display: "flex", gap: 4, mb: 2 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            選取訂單數
          </Typography>
          <Typography variant="h5">{selectedOrderCount} 筆</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            合併後總金額
          </Typography>
          <Typography variant="h5">{formatCurrency(totalAmount)}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            合併後明細項目數
          </Typography>
          <Typography variant="h5">{lineItemCount} 項</Typography>
        </Box>
      </Box>
      <Alert severity="warning" sx={{ mb: 2 }}>
        合併後，所有來源訂單將被取消，並建立一筆包含所有明細項目的新訂單。此操作無法復原。
      </Alert>
      <Button
        variant="contained"
        startIcon={
          isPending ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <MergeIcon />
          )
        }
        onClick={onMerge}
        disabled={isPending}
      >
        {isPending ? "合併中..." : "確認合併"}
      </Button>
    </Paper>
  );
}
