import { EntitySelect } from "@/components/EntitySelect";
import { ProductOptionValueSelects } from "@/components/ProductOptionValueSelects";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useEffect, useState } from "react";
import type {
  OrderItemSelectedOptionSnapshot,
  Product,
  ProductOptionValue,
} from "@shared/models";
import { useProduct } from "@/hooks/useProducts";
import type { CreateOrderItemInput } from "./formTypes";
import {
  buildOrderItemFormData,
  createDefaultOrderItemDraft,
  getOrderItemDraftError,
  resolveDraftUnitPrice,
} from "./orderItemDraft";
import { searchProducts } from "./search";

/** 編輯模式時傳入的既有明細資料 */
export interface OrderItemEditData {
  productId: string;
  productName: string;
  productImageUrl?: string | null;
  productSku: string;
  variantLabel: string | null;
  selectedOptionsSnapshot?: OrderItemSelectedOptionSnapshot[];
  quantity: number;
  unitPrice: number;
  unitCost?: number | null;
}

export interface OrderItemDialogProps {
  open: boolean;
  /** 傳入既有資料時為編輯模式，null 時為新增模式 */
  editData: OrderItemEditData | null;
  onClose: () => void;
  onSubmit: (input: CreateOrderItemInput) => void;
}

export function OrderItemDialog({
  open,
  editData,
  onClose,
  onSubmit,
}: OrderItemDialogProps): React.ReactElement {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptionValues, setSelectedOptionValues] = useState<
    Record<string, ProductOptionValue | null>
  >({});
  const [legacyVariantLabel, setLegacyVariantLabel] = useState<string | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 編輯模式時，載入完整商品資料
  const { data: productDetail } = useProduct(
    open && editData ? editData.productId : "",
  );

  const isEditMode = editData !== null;
  const title = isEditMode ? "編輯明細" : "新增明細";
  const submitLabel = isEditMode ? "儲存" : "新增";

  // 開啟時初始化狀態
  useEffect(() => {
    if (!open) {
      return;
    }

    if (!editData) {
      // 新增模式：重置為預設值
      const draft = createDefaultOrderItemDraft();
      setSelectedProduct(draft.product);
      setSelectedOptionValues({});
      setLegacyVariantLabel(draft.legacyVariantLabel);
      setQuantity(draft.quantity);
      setUnitPrice(draft.unitPrice);
    } else {
      // 編輯模式：設定數量與單價，商品待 productDetail 載入後設定
      setQuantity(editData.quantity);
      setUnitPrice(editData.unitPrice);
      setSelectedProduct(null);
      setSelectedOptionValues({});
      setLegacyVariantLabel(editData.variantLabel);
    }
    setError(null);
  }, [open, editData]);

  // 編輯模式：商品資料載入後設定 selectedProduct 與已選規格值
  useEffect(() => {
    if (!open || !editData || !productDetail) {
      return;
    }

    setSelectedProduct(productDetail);

    if (productDetail.options.length > 0) {
      const fallbackTokens =
        editData.variantLabel
          ?.split("/")
          .map((token) => token.trim())
          .filter(Boolean) ?? [];

      const nextSelectedValues = Object.fromEntries(
        productDetail.options.map((option, index) => {
          const matchedSnapshot =
            editData.selectedOptionsSnapshot?.find(
              (snapshot) => snapshot.optionName === option.name,
            ) ?? null;
          const matchedValue =
            option.values.find(
              (value) =>
                value.name === matchedSnapshot?.valueName ||
                value.name === fallbackTokens[index],
            ) ?? null;
          return [option.id, matchedValue];
        }),
      );

      setSelectedOptionValues(nextSelectedValues);
    } else {
      setSelectedOptionValues({});
    }
  }, [open, editData, productDetail]);

  const handleProductChange = (product: Product | null): void => {
    setSelectedProduct(product);
    setSelectedOptionValues({});
    setLegacyVariantLabel(null);
    setError(null);

    if (product) {
      setUnitPrice(resolveDraftUnitPrice(product, []));
      return;
    }

    setUnitPrice(0);
  };

  const handleOptionValueChange = (
    optionId: string,
    value: ProductOptionValue | null,
  ): void => {
    const nextSelectedOptionValues = {
      ...selectedOptionValues,
      [optionId]: value,
    };
    setSelectedOptionValues(nextSelectedOptionValues);
    setError(null);

    if (!selectedProduct) {
      return;
    }

    const selectedValues = selectedProduct.options
      .map((option) => nextSelectedOptionValues[option.id] ?? null)
      .filter(
        (optionValue): optionValue is ProductOptionValue =>
          optionValue !== null,
      );

    setUnitPrice(resolveDraftUnitPrice(selectedProduct, selectedValues));
  };

  const handleSubmit = (): void => {
    const draft = {
      product: selectedProduct,
      selectedOptionValues: Object.values(selectedOptionValues).filter(
        (value): value is ProductOptionValue => value !== null,
      ),
      legacyVariantLabel,
      quantity,
      unitPrice,
    };
    const validationError = getOrderItemDraftError(draft);

    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit(buildOrderItemFormData(draft));
    onClose();
  };

  const hasOptions = (selectedProduct?.options.length ?? 0) > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <EntitySelect<Product>
            label="商品"
            value={selectedProduct}
            onChange={handleProductChange}
            queryKey={["products", "order-line-item-dialog"]}
            searchFn={searchProducts}
            getOptionLabel={(product) => `${product.name}（${product.sku}）`}
            required
          />
          {hasOptions ? (
            <ProductOptionValueSelects
              options={selectedProduct?.options ?? []}
              value={selectedOptionValues}
              onChange={handleOptionValueChange}
              error={error === "請選取所有規格選項" ? error : undefined}
            />
          ) : null}
          <TextField
            label="數量"
            type="number"
            value={quantity}
            onChange={(event) => {
              setQuantity(Math.max(1, parseInt(event.target.value, 10) || 1));
              setError(null);
            }}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            required
            fullWidth
          />
          {isEditMode && (
            <TextField
              label="單價"
              type="number"
              value={unitPrice}
              onChange={(event) => {
                setUnitPrice(
                  Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                );
                setError(null);
              }}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              required
              fullWidth
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          取消
        </Button>
        <Button onClick={handleSubmit} variant="contained">
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
