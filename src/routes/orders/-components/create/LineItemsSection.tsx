import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { LineItemFormData } from "./formTypes";
import { LineItemRow } from "./LineItemRow";

export interface LineItemsSectionProps {
  lineItems: LineItemFormData[];
  totalAmount: number;
  onAddLineItem: () => void;
  onRemoveLineItem: (index: number) => void;
  onUpdateLineItem: (
    index: number,
    updates: Partial<LineItemFormData>,
  ) => void;
}

export function LineItemsSection({
  lineItems,
  totalAmount,
  onAddLineItem,
  onRemoveLineItem,
  onUpdateLineItem,
}: LineItemsSectionProps): React.ReactElement {
  return (
    <Paper sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6">明細項目</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={onAddLineItem}
        >
          新增明細
        </Button>
      </Box>

      {lineItems.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center", py: 4 }}
        >
          尚未新增明細項目，請點擊「新增明細」按鈕
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>商品</TableCell>
                <TableCell>規格組合</TableCell>
                <TableCell>數量</TableCell>
                <TableCell>單價</TableCell>
                <TableCell align="right">小計</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lineItems.map((item, index) => (
                <LineItemRow
                  key={item.tempId}
                  item={item}
                  index={index}
                  onRemove={() => onRemoveLineItem(index)}
                  onUpdate={(updates) => onUpdateLineItem(index, updates)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {lineItems.length > 0 && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            mt: 2,
            pt: 2,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="h6">
            總金額：{totalAmount.toLocaleString()}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
