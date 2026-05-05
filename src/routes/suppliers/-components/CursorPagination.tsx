import Box from "@mui/material/Box";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { SelectChangeEvent } from "@mui/material/Select";

/**
 * CursorPagination 元件 Props
 * 需求：6.1, 6.2, 6.3, 6.7
 */
export interface CursorPaginationProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  currentCount: number;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

/**
 * 游標式分頁控制元件
 *
 * 顯示「每頁筆數」下拉選單、「顯示 {count} 筆」文字、上一頁/下一頁按鈕。
 * 需求：6.1, 6.2, 6.3, 6.7
 */
export function CursorPagination({
  pageSize,
  onPageSizeChange,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  currentCount,
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
      {/* 每頁筆數下拉選單 - 需求 6.1 */}
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

      {/* 顯示筆數文字 - 需求 6.7 */}
      <Typography variant="body2" color="text.secondary">
        顯示 {currentCount} 筆
      </Typography>

      {/* 上一頁按鈕 - 需求 6.3 */}
      <IconButton
        onClick={onPrevPage}
        disabled={!hasPrevPage}
        aria-label="上一頁"
        size="small"
      >
        <ChevronLeftIcon />
      </IconButton>

      {/* 下一頁按鈕 - 需求 6.2 */}
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
