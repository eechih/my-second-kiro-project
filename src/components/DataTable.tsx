import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { listTableBodyTextSx } from "./listTableStyles";

export interface DataTableProps<T> {
  /** TanStack Table 欄位定義 */
  columns: ColumnDef<T, unknown>[];
  /** 表格資料 */
  data: T[];
  /** 資料總筆數 */
  totalCount: number;
  /** 每頁筆數 */
  pageSize: number;
  /** 每頁筆數變更回呼 */
  onPageSizeChange: (pageSize: number) => void;
  /** 是否有下一頁（由 API 回傳的 nextToken 是否存在決定） */
  hasNextPage: boolean;
  /** 是否有上一頁（由 tokenStack 長度 > 0 或 currentToken !== undefined 決定） */
  hasPrevPage: boolean;
  /** 點擊下一頁（呼叫 useCursorPagination 的 goNext） */
  onNextPage: () => void;
  /** 點擊上一頁（呼叫 useCursorPagination 的 goPrev） */
  onPrevPage: () => void;
  /** 是否載入中 */
  isLoading: boolean;
  /** 行點擊回呼 */
  onRowClick?: (row: T) => void;
  /** 行滑鼠進入回呼（用於預取） */
  onRowMouseEnter?: (row: T) => void;
  /** 是否啟用排序（預設 true） */
  enableSorting?: boolean;
  /** 是否隱藏分頁列 */
  hidePagination?: boolean;
}

/**
 * 通用分頁表格元件。
 *
 * 使用 TanStack Table 的 useReactTable + getCoreRowModel，
 * 搭配 MUI Table 元件渲染。
 * 分頁使用游標式分頁（Cursor-Based Pagination），
 * 搭配 useCursorPagination hook 使用。
 *
 * 需求：1.1, 2.1, 3.1, 4.2
 */
export function DataTable<T>({
  columns,
  data,
  totalCount,
  pageSize,
  onPageSizeChange,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  isLoading,
  onRowClick,
  onRowMouseEnter,
  enableSorting = true,
  hidePagination = false,
}: DataTableProps<T>): React.ReactElement {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    manualPagination: true,
  });

  return (
    <Paper sx={{ width: "100%", overflow: "hidden" }}>
      <TableContainer>
        <Table stickyHeader size="medium" sx={listTableBodyTextSx}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = enableSorting && header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();

                  return (
                    <TableCell
                      key={header.id}
                      sortDirection={sortDirection || false}
                      sx={{
                        fontWeight: 600,
                        cursor: canSort ? "pointer" : "default",
                        userSelect: canSort ? "none" : "auto",
                      }}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <TableSortLabel
                          active={!!sortDirection}
                          direction={sortDirection || "asc"}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </TableSortLabel>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  sx={{ textAlign: "center", py: 4 }}
                >
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  sx={{ textAlign: "center", py: 4 }}
                >
                  <Typography color="text.secondary">暫無資料</Typography>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                  onMouseEnter={
                    onRowMouseEnter
                      ? () => onRowMouseEnter(row.original)
                      : undefined
                  }
                  sx={{
                    cursor: onRowClick ? "pointer" : "default",
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const renderedCell = flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    );

                    return (
                      <TableCell key={cell.id}>
                        {typeof renderedCell === "string" ||
                        typeof renderedCell === "number" ? (
                          <Typography variant="body2">
                            {renderedCell}
                          </Typography>
                        ) : (
                          renderedCell
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {!hidePagination && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            px: 2,
            py: 1.5,
            borderTop: 1,
            borderColor: "divider",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              每頁筆數
            </Typography>
            <FormControl size="small" variant="outlined">
              <Select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                sx={{ minWidth: 70 }}
              >
                {[5, 10, 25, 50].map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {data.length === 0
              ? "0 筆"
              : `顯示 ${data.length} 筆${totalCount > 0 ? ` / 共 ${totalCount} 筆` : ""}`}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              onClick={onPrevPage}
              disabled={!hasPrevPage}
              aria-label="上一頁"
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={onNextPage}
              disabled={!hasNextPage}
              aria-label="下一頁"
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
