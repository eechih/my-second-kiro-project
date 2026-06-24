import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SettingsIcon from "@mui/icons-material/Settings";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnVisibility {
  key: string;
  label: string;
  visible: boolean;
}

export interface CursorPaginationBarProps {
  /** Current page number (1-indexed) */
  pageNumber: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPrevPage: boolean;
  /** Go to next page */
  onNextPage: () => void;
  /** Go to previous page */
  onPrevPage: () => void;
  /** Current page size */
  pageSize: number;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Called when page size changes */
  onPageSizeChange: (size: number) => void;
  /** Column visibility config (optional — omit to hide column settings) */
  columns?: ColumnVisibility[];
  /** Called when column visibility changes */
  onColumnsChange?: (columns: ColumnVisibility[]) => void;
  /** Number of items on the current page */
  currentCount?: number;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 300];

// ---------------------------------------------------------------------------
// Preferences Dialog
// ---------------------------------------------------------------------------

interface PreferencesDialogProps {
  open: boolean;
  pageSize: number;
  pageSizeOptions: number[];
  columns: ColumnVisibility[];
  onClose: () => void;
  onSave: (pageSize: number, columns: ColumnVisibility[]) => void;
}

function PreferencesDialog({
  open,
  pageSize,
  pageSizeOptions,
  columns,
  onClose,
  onSave,
}: PreferencesDialogProps): React.ReactElement {
  const [draftPageSize, setDraftPageSize] = useState(pageSize);
  const [draftColumns, setDraftColumns] = useState(columns);

  const handleOpen = (): void => {
    setDraftPageSize(pageSize);
    setDraftColumns(columns);
  };

  const handleToggleColumn = (key: string): void => {
    setDraftColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col,
      ),
    );
  };

  const handleSelectAll = (): void => {
    setDraftColumns((prev) => prev.map((col) => ({ ...col, visible: true })));
  };

  const handleDeselectAll = (): void => {
    setDraftColumns((prev) => prev.map((col) => ({ ...col, visible: false })));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ transition: { onEnter: handleOpen } }}
    >
      <DialogTitle>偏好設定</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
          <Box sx={{ minWidth: 140 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              頁面大小
            </Typography>
            <RadioGroup
              value={String(draftPageSize)}
              onChange={(e) => setDraftPageSize(Number(e.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <FormControlLabel
                  key={size}
                  value={String(size)}
                  control={<Radio size="small" />}
                  label={`${size} 個項目`}
                />
              ))}
            </RadioGroup>
          </Box>

          {draftColumns.length > 0 ? (
            <Box sx={{ flex: 1 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mb: 1, alignItems: "center" }}
              >
                <Typography variant="subtitle2">選取屬性</Typography>
                <Box sx={{ ml: "auto" }}>
                  <Button size="small" onClick={handleSelectAll}>
                    全選
                  </Button>
                  <Button size="small" onClick={handleDeselectAll}>
                    取消全選
                  </Button>
                </Box>
              </Stack>
              <Stack spacing={0}>
                {draftColumns.map((col) => (
                  <FormControlLabel
                    key={col.key}
                    control={
                      <Switch
                        size="small"
                        checked={col.visible}
                        onChange={() => handleToggleColumn(col.key)}
                      />
                    }
                    label={col.label}
                    sx={{ mx: 0 }}
                  />
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          onClick={() => onSave(draftPageSize, draftColumns)}
        >
          儲存變更
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CursorPaginationBar({
  pageNumber,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  columns = [],
  onColumnsChange,
  currentCount,
}: CursorPaginationBarProps): React.ReactElement {
  const [prefsOpen, setPrefsOpen] = useState(false);

  const handleSavePrefs = useCallback(
    (newPageSize: number, newColumns: ColumnVisibility[]): void => {
      if (newPageSize !== pageSize) {
        onPageSizeChange(newPageSize);
      }
      if (onColumnsChange && newColumns !== columns) {
        onColumnsChange(newColumns);
      }
      setPrefsOpen(false);
    },
    [columns, onColumnsChange, onPageSizeChange, pageSize],
  );

  // Build page number display
  const pageNumbers: (number | "...")[] = [];
  for (let i = 1; i <= pageNumber; i++) {
    if (i === 1 || i === pageNumber || i === pageNumber - 1) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== "...") {
      pageNumbers.push("...");
    }
  }
  if (hasNextPage && pageNumbers[pageNumbers.length - 1] !== "...") {
    pageNumbers.push("...");
  }

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0.5,
          py: 1,
        }}
      >
        <IconButton
          size="small"
          onClick={onPrevPage}
          disabled={!hasPrevPage}
          aria-label="上一頁"
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>

        {pageNumbers.map((p, idx) =>
          p === "..." ? (
            <Typography
              key={`ellipsis-${idx}`}
              variant="body2"
              color="text.secondary"
              sx={{ px: 0.5 }}
            >
              …
            </Typography>
          ) : (
            <Button
              key={p}
              size="small"
              variant={p === pageNumber ? "contained" : "text"}
              sx={{
                minWidth: 28,
                px: 0.5,
                fontWeight: p === pageNumber ? 700 : 400,
              }}
              disabled={p === pageNumber}
            >
              {p}
            </Button>
          ),
        )}

        <IconButton
          size="small"
          onClick={onNextPage}
          disabled={!hasNextPage}
          aria-label="下一頁"
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>

        <Box
          sx={{
            borderLeft: "1px solid",
            borderColor: "divider",
            height: 24,
            mx: 0.5,
          }}
        />

        <IconButton
          size="small"
          onClick={() => setPrefsOpen(true)}
          aria-label="偏好設定"
        >
          <SettingsIcon fontSize="small" />
        </IconButton>

        {currentCount != null ? (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            ({currentCount})
          </Typography>
        ) : null}
      </Box>

      <PreferencesDialog
        open={prefsOpen}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        columns={columns}
        onClose={() => setPrefsOpen(false)}
        onSave={handleSavePrefs}
      />
    </>
  );
}
