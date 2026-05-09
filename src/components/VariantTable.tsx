import { useState, useCallback, useMemo } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import type { ProductVariant } from "../../shared/models/product";
import type { UpdateVariantInput } from "../../shared/models/product";
import { DataTable } from "./DataTable";

export interface VariantTableProps {
  /** 商品 ID */
  productId: string;
  /** 規格組合列表 */
  variants: ProductVariant[];
  /** 商品預設單價 */
  defaultUnitPrice: number;
  /** 商品預設進貨成本 */
  defaultCost: number;
  /** 更新規格組合回呼 */
  onUpdateVariant: (variantId: string, updates: UpdateVariantInput) => void;
  /** 刪除規格組合回呼 */
  onDeleteVariant: (variantId: string) => void;
  /** 是否載入中 */
  isLoading?: boolean;
}

interface EditingState {
  variantId: string;
  priceOffset: string;
  costOffset: string;
}

const columnHelper = createColumnHelper<ProductVariant>();

/**
 * 規格組合表格元件。
 *
 * 用於商品詳情/編輯頁面，以表格形式顯示所有規格組合。
 * 使用偏移量模式：顯示有效價格（預設 + 偏移量），編輯時輸入偏移量。
 *
 * 需求：3.15, 3.16
 */
export function VariantTable({
  productId: _productId,
  variants,
  defaultUnitPrice,
  defaultCost,
  onUpdateVariant,
  onDeleteVariant,
  isLoading = false,
}: VariantTableProps): React.ReactElement {
  const [editing, setEditing] = useState<EditingState | null>(null);

  const startEditing = useCallback((variant: ProductVariant) => {
    setEditing({
      variantId: variant.id,
      priceOffset:
        variant.priceOffset !== null ? String(variant.priceOffset) : "",
      costOffset:
        variant.costOffset !== null ? String(variant.costOffset) : "",
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditing(null);
  }, []);

  const saveEditing = useCallback(() => {
    if (!editing) return;

    const updates: UpdateVariantInput = {};

    if (editing.priceOffset === "") {
      updates.priceOffset = null;
    } else {
      const parsed = Number(editing.priceOffset);
      if (!isNaN(parsed)) {
        updates.priceOffset = parsed;
      }
    }

    if (editing.costOffset === "") {
      updates.costOffset = null;
    } else {
      const parsed = Number(editing.costOffset);
      if (!isNaN(parsed)) {
        updates.costOffset = parsed;
      }
    }

    onUpdateVariant(editing.variantId, updates);
    setEditing(null);
  }, [editing, onUpdateVariant]);

  const columns = useMemo(
    (): ColumnDef<ProductVariant, unknown>[] => [
      columnHelper.accessor("label", {
        header: "規格組合",
        cell: (info) => info.getValue(),
        enableSorting: true,
      }) as ColumnDef<ProductVariant, unknown>,
      columnHelper.display({
        id: "unitPrice",
        header: "單價",
        cell: (info) => {
          const variant = info.row.original;
          if (editing?.variantId === variant.id) {
            return (
              <TextField
                size="small"
                type="number"
                value={editing.priceOffset}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    priceOffset: e.target.value,
                  })
                }
                placeholder="0"
                helperText={`有效單價：${defaultUnitPrice + (Number(editing.priceOffset) || 0)}`}
                sx={{ minWidth: 100 }}
                slotProps={{
                  htmlInput: { step: "any" },
                }}
              />
            );
          }
          const offset = variant.priceOffset ?? 0;
          const effectivePrice = defaultUnitPrice + offset;
          return (
            <Box component="span">
              {effectivePrice}
              {offset !== 0 && (
                <Box
                  component="span"
                  sx={{ ml: 0.5, color: offset > 0 ? "error.main" : "success.main", fontSize: "0.85em" }}
                >
                  ({offset > 0 ? "+" : ""}{offset})
                </Box>
              )}
            </Box>
          );
        },
      }) as ColumnDef<ProductVariant, unknown>,
      columnHelper.display({
        id: "defaultCost",
        header: "進貨成本",
        cell: (info) => {
          const variant = info.row.original;
          if (editing?.variantId === variant.id) {
            return (
              <TextField
                size="small"
                type="number"
                value={editing.costOffset}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    costOffset: e.target.value,
                  })
                }
                placeholder="0"
                helperText={`有效成本：${defaultCost + (Number(editing.costOffset) || 0)}`}
                sx={{ minWidth: 100 }}
                slotProps={{
                  htmlInput: { step: "any" },
                }}
              />
            );
          }
          const offset = variant.costOffset ?? 0;
          const effectiveCost = defaultCost + offset;
          return (
            <Box component="span">
              {effectiveCost}
              {offset !== 0 && (
                <Box
                  component="span"
                  sx={{ ml: 0.5, color: offset > 0 ? "error.main" : "success.main", fontSize: "0.85em" }}
                >
                  ({offset > 0 ? "+" : ""}{offset})
                </Box>
              )}
            </Box>
          );
        },
      }) as ColumnDef<ProductVariant, unknown>,
      columnHelper.display({
        id: "actions",
        header: "操作",
        cell: (info) => {
          const variant = info.row.original;
          if (editing?.variantId === variant.id) {
            return (
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <Tooltip title="儲存">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={saveEditing}
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="取消">
                  <IconButton size="small" onClick={cancelEditing}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            );
          }
          return (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="編輯">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(variant);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="刪除">
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteVariant(variant.id);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          );
        },
      }) as ColumnDef<ProductVariant, unknown>,
    ],
    [
      editing,
      defaultUnitPrice,
      defaultCost,
      startEditing,
      cancelEditing,
      saveEditing,
      onDeleteVariant,
    ],
  );

  return (
    <DataTable
      columns={columns}
      data={variants}
      totalCount={variants.length}
      pageSize={variants.length || 1}
      onPageSizeChange={() => {}}
      hasNextPage={false}
      hasPrevPage={false}
      onNextPage={() => {}}
      onPrevPage={() => {}}
      isLoading={isLoading}
      enableSorting={true}
      hidePagination
    />
  );
}
