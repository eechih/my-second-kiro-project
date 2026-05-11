import { EntitySelect } from "@/components/EntitySelect";
import { VariantSelect } from "@/components/VariantSelect";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useEffect, useState } from "react";
import type { Product, ProductVariant } from "@shared/models";
import type { CreateLineItemInput } from "./formTypes";
import {
  buildLineItemFormData,
  createDefaultLineItemDraft,
  getLineItemDraftError,
  resolveDraftUnitPrice,
} from "./lineItemDraft";
import { searchProducts } from "./search";

export interface AddLineItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateLineItemInput) => void;
}

export function AddLineItemDialog({
  open,
  onClose,
  onSubmit,
}: AddLineItemDialogProps): React.ReactElement {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const draft = createDefaultLineItemDraft();
    setSelectedProduct(draft.product);
    setSelectedVariant(draft.variant);
    setQuantity(draft.quantity);
    setUnitPrice(draft.unitPrice);
    setError(null);
  }, [open]);

  const handleProductChange = (product: Product | null): void => {
    setSelectedProduct(product);
    setSelectedVariant(null);
    setError(null);

    if (product) {
      setUnitPrice(resolveDraftUnitPrice(product, null));
      return;
    }

    setUnitPrice(0);
  };

  const handleVariantChange = (variant: ProductVariant | null): void => {
    setSelectedVariant(variant);
    setError(null);

    if (!selectedProduct) {
      return;
    }

    setUnitPrice(resolveDraftUnitPrice(selectedProduct, variant));
  };

  const handleSubmit = (): void => {
    const draft = {
      product: selectedProduct,
      variant: selectedVariant,
      quantity,
      unitPrice,
    };
    const validationError = getLineItemDraftError(draft);

    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit(buildLineItemFormData(draft));
    onClose();
  };

  const hasVariants = (selectedProduct?.variants.length ?? 0) > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>新增明細</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <EntitySelect<Product>
            label="商品"
            value={selectedProduct}
            onChange={handleProductChange}
            queryKey={["products", "order-create-dialog"]}
            searchFn={searchProducts}
            getOptionLabel={(product) => `${product.name}（${product.sku}）`}
            required
          />
          {hasVariants ? (
            <VariantSelect
              productId={selectedProduct?.id ?? ""}
              variants={selectedProduct?.variants ?? []}
              value={selectedVariant}
              onChange={handleVariantChange}
              error={error === "請選取規格組合" ? error : undefined}
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
          <TextField
            label="單價"
            type="number"
            value={unitPrice}
            onChange={(event) => {
              setUnitPrice(Math.max(0, Math.trunc(Number(event.target.value) || 0)));
              setError(null);
            }}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            required
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          取消
        </Button>
        <Button onClick={handleSubmit} variant="contained">
          新增
        </Button>
      </DialogActions>
    </Dialog>
  );
}
