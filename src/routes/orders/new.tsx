import { PageHeader } from "@/components/PageHeader";
import { useCreateOrder } from "@/hooks/useOrders";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { calculateLineItemSubtotal } from "@shared/logic/order-calculations";
import type { Customer } from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { OrderCustomerSection } from "./-components/OrderCustomerSection";
import { OrderFormActions } from "./-components/OrderFormActions";
import { OrderLineItemsSection } from "./-components/OrderLineItemsSection";
import {
  generateTempId,
  type LineItemFormData,
} from "./-components/orderFormTypes";

export const Route = createFileRoute("/orders/new")({
  beforeLoad: requireAuth,
  component: OrderNewPage,
});

function OrderNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateOrder();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([]);

  const form = useForm({
    defaultValues: {
      customerId: "",
      customerName: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      // Validate customer
      if (!value.customerId) {
        setSubmitError("請選取客戶");
        return;
      }

      // Validate line items
      if (lineItems.length === 0) {
        setSubmitError("請至少新增一筆明細項目");
        return;
      }

      // Validate each line item
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i]!;
        if (!item.productId) {
          setSubmitError(`第 ${i + 1} 筆明細項目未選取商品`);
          return;
        }
        if (item.quantity <= 0) {
          setSubmitError(`第 ${i + 1} 筆明細項目數量必須大於 0`);
          return;
        }
      }

      try {
        await createMutation.mutateAsync({
          customerId: value.customerId,
          customerName: value.customerName,
          lineItems: lineItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            variantId: item.variantId,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        });
        void navigate({ to: "/orders" });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "建立訂單失敗");
      }
    },
  });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const handleCustomerChange = useCallback(
    (customer: Customer | null) => {
      setSelectedCustomer(customer);
      if (customer) {
        form.setFieldValue("customerId", customer.id);
        form.setFieldValue("customerName", customer.name);
      } else {
        form.setFieldValue("customerId", "");
        form.setFieldValue("customerName", "");
      }
    },
    [form],
  );

  const handleAddLineItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      {
        tempId: generateTempId(),
        productId: "",
        productName: "",
        variantId: null,
        variantLabel: null,
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }, []);

  const handleRemoveLineItem = useCallback((index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateLineItem = useCallback(
    (index: number, updates: Partial<LineItemFormData>) => {
      setLineItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  // Calculate total amount
  const totalAmount = lineItems.reduce(
    (sum, item) =>
      sum + calculateLineItemSubtotal(item.quantity, item.unitPrice),
    0,
  );

  return (
    <Box>
      <PageHeader section="訂單" current="新增" title="新增訂單" />

      {submitError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setSubmitError(null)}
        >
          {submitError}
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <Stack spacing={3}>
          <OrderCustomerSection
            selectedCustomer={selectedCustomer}
            showError={form.state.isSubmitted && !selectedCustomer}
            onCustomerChange={handleCustomerChange}
          />

          <OrderLineItemsSection
            lineItems={lineItems}
            totalAmount={totalAmount}
            onAddLineItem={handleAddLineItem}
            onRemoveLineItem={handleRemoveLineItem}
            onUpdateLineItem={handleUpdateLineItem}
          />

          <OrderFormActions
            isSubmitting={createMutation.isPending}
            onCancel={() => void navigate({ to: "/orders" })}
          />
        </Stack>
      </form>
    </Box>
  );
}
