import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { Order } from "@shared/models";

export interface SplitInfoCardProps {
  order: Order;
}

export function SplitInfoCard({
  order,
}: SplitInfoCardProps): React.ReactElement {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        訂單資訊
      </Typography>
      <Box sx={{ display: "flex", gap: 4 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            客戶
          </Typography>
          <Typography>{order.customerName}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            總金額
          </Typography>
          <Typography>${order.totalAmount.toLocaleString()}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            明細項目數
          </Typography>
          <Typography>{order.lineItems.length} 項</Typography>
        </Box>
      </Box>
    </Paper>
  );
}
