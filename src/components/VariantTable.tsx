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
  /** 商品預設單價（用於顯示未覆寫時的值） */
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
  price: string;
  cost: string;
}

const columnHelper = createColumnHelper<ProductVariant>();

/**
 * 規格組合表格元件。
 *
 * 用於商品詳情/編輯頁面，以表格形式顯示所有規格組合。
 * 使用 DataTable 元件，欄位包含：規格組合名稱、SKU、單價、進貨成本、庫存數量。
 * 支援行內編輯 SKU、單價覆寫、成本覆寫。
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
      price:
        variant.price !== null
          ? String(variant.price)
          : "",
      cost:
        variant.cost !== null
          ? String(variant.cost)
          : "",
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditing(null);
  }, []);

  const saveEditing = useCallback(() => {
    if (!editing) return;

    const updates: UpdateVariantInput = {};

    // Unit price override
    if (editing.price === "") {
      updates.price = null;
    } else {
      const parsed = Number(editing.price);
      if (!isNaN(parsed) && parsed >= 0) {
        updates.price = parsed;
      }
    }

    // Default cost override
    if (editing.cost === "") {
      updates.cost = null;
    } else {
      const parsed = Number(editing.cost);
      if (!isNaN(parsed) && parsed >= 0) {
        updates.cost = parsed;
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
                value={editing.price}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    price: e.target.value,
                  })
                }
                placeholder={String(defaultUnitPrice)}
                sx={{ minWidth: 100 }}
                slotProps={{
                  htmlInput: { min: 0, step: "any" },
                }}
              />
            );
          }
          const effectivePrice =
            variant.price !== null
              ? variant.price
              : defaultUnitPrice;
          const isOverridden = variant.price !== null;
          return (
            <Box
              component="span"
              sx={{ fontWeight: isOverridden ? 600 : "normal" }}
            >
              {effectivePrice}
              {isOverridden ? "" : "（預設）"}
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
                value={editing.cost}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    cost: e.target.value,
                  })
                }
                placeholder={String(defaultCost)}
                sx={{ minWidth: 100 }}
                slotProps={{
                  htmlInput: { min: 0, step: "any" },
                }}
              />
            );
          }
          const effectiveCost =
            variant.cost !== null
              ? variant.cost
              : defaultCost;
          const isOverridden = variant.cost !== null;
          return (
            <Box
              component="span"
              sx={{ fontWeight: isOverridden ? 600 : "normal" }}
            >
              {effectiveCost}
              {isOverridden ? "" : "（預設）"}
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
