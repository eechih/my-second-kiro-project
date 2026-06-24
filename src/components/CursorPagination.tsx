import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import type { SelectChangeEvent } from "@mui/material/Select";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";

export interface CursorPaginationProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  currentCount: number;
  totalCount?: number;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function CursorPagination({
  pageSize,
  onPageSizeChange,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  currentCount,
  totalCount,
}: CursorPaginationProps): React.ReactElement {
  const handlePageSizeChange = (event: SelectChangeEvent<number>): void => {
    onPageSizeChange(Number(event.target.value));
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 2,
        py: 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          每頁筆數
        </Typography>
        <FormControl size="small">
          <Select<number>
            value={pageSize}
            onChange={handlePageSizeChange}
            sx={{ minWidth: 70 }}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Typography variant="body2" color="text.secondary">
        顯示 {currentCount} 筆
        {totalCount != null ? ` / 共 ${totalCount} 筆` : ""}
      </Typography>

      <IconButton
        onClick={onPrevPage}
        disabled={!hasPrevPage}
        aria-label="上一頁"
        size="small"
      >
        <ChevronLeftIcon />
      </IconButton>
      <IconButton
        onClick={onNextPage}
        disabled={!hasNextPage}
        aria-label="下一頁"
        size="small"
      >
        <ChevronRightIcon />
      </IconButton>
    </Box>
  );
}
