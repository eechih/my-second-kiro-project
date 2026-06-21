import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export interface CustomerMergePanelProps {
  customerId: string;
  customerName: string;
}

/**
 * 訂單合併功能已於模型簡化後移除。
 * 此元件保留介面相容性，僅顯示提示訊息。
 */
export function CustomerMergePanel({
  customerName,
}: CustomerMergePanelProps): React.ReactElement {
  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          合併訂單
        </Typography>
        <Alert severity="info">
          訂單模型已簡化為一筆訂單 = 一個商品，合併訂單功能已停用。如需調整「
          {customerName}」的訂單，請直接編輯個別訂單。
        </Alert>
      </Stack>
    </Paper>
  );
}
