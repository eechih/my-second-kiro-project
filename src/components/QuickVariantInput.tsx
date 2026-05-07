import { useState, useCallback, useEffect } from "react";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import type { SpecDimension } from "../../shared/models/product";
import {
  parseVariantShorthand,
  printVariantShorthand,
  countCombinations,
} from "../../shared/logic/variant-shorthand";
import { ConfirmDialog } from "./ConfirmDialog";

export interface QuickVariantInputProps {
  /** 套用回呼，傳入解析後的 SpecDimension 陣列 */
  onApply: (dimensions: SpecDimension[]) => void;
  /** 初始規格維度（編輯模式時顯示既有內容） */
  initialDimensions?: SpecDimension[];
  /** 是否有既有規格組合（用於決定是否顯示確認對話框） */
  hasExistingVariants?: boolean;
  /** 是否正在處理中（顯示 loading 狀態） */
  loading?: boolean;
  /** 是否停用（唯讀模式時隱藏） */
  disabled?: boolean;
}

const MAX_COMBINATIONS = 100;

/**
 * 快速規格輸入元件。
 *
 * 提供文字輸入欄位，讓使用者以簡寫語法快速定義規格維度。
 * 輸入時即時解析並顯示預覽，套用後將 SpecDimension[] 傳遞給父元件。
 *
 * 需求：4.1、4.2、4.3、4.4、4.5、4.6、4.7、5.3、5.4
 */
export function QuickVariantInput({
  onApply,
  initialDimensions,
  hasExistingVariants = false,
  loading = false,
  disabled = false,
}: QuickVariantInputProps): React.ReactElement | null {
  const [input, setInput] = useState(() =>
    initialDimensions && initialDimensions.length > 0
      ? printVariantShorthand(initialDimensions)
      : "",
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 當 initialDimensions 從外部載入時同步更新輸入欄位
  useEffect(() => {
    if (initialDimensions && initialDimensions.length > 0) {
      setInput(printVariantShorthand(initialDimensions));
    }
  }, [initialDimensions]);

  const dimensions = parseVariantShorthand(input);
  const combinations = countCombinations(dimensions);
  const hasResult = dimensions.length > 0;
  const exceedsLimit = combinations > MAX_COMBINATIONS;

  const handleApplyClick = useCallback(() => {
    if (hasExistingVariants) {
      setConfirmOpen(true);
    } else {
      onApply(dimensions);
    }
  }, [hasExistingVariants, onApply, dimensions]);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    onApply(dimensions);
  }, [onApply, dimensions]);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  // 唯讀模式時隱藏元件
  if (disabled) {
    return null;
  }

  return (
    <Box>
      <TextField
        label="快速規格輸入"
        placeholder="例：白，黑/35，36，37，38，39，40"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        fullWidth
        size="small"
      />

      {hasResult && (
        <Box sx={{ mt: 1.5 }}>
          {/* 維度預覽 */}
          {dimensions.map((dim) => (
            <Box key={dim.name} sx={{ mb: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mr: 1 }}
              >
                {dim.name}
              </Typography>
              {dim.values.map((value) => (
                <Chip
                  key={value}
                  label={value}
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              ))}
            </Box>
          ))}

          {/* 組合數提示 */}
          <Typography
            variant="body2"
            color={exceedsLimit ? "error" : "text.secondary"}
            sx={{ mt: 1 }}
          >
            {exceedsLimit
              ? `組合數 ${combinations} 超過上限（最多 ${MAX_COMBINATIONS} 個組合）`
              : `將產生 ${combinations} 個規格組合`}
          </Typography>

          {/* 套用按鈕 */}
          <Button
            variant="contained"
            size="small"
            disabled={exceedsLimit || loading}
            onClick={handleApplyClick}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
            sx={{ mt: 1 }}
          >
            {loading ? "規格組合處理中…" : "套用"}
          </Button>
        </Box>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="確認套用"
        message="套用新的規格維度將取代所有既有規格組合（包含庫存與價格設定）。確定要繼續嗎？"
        confirmLabel="確認套用"
        confirmColor="warning"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
}
