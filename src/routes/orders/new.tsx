import { PageHeader } from "@/components/PageHeader";
import { useCreateOrder } from "@/hooks/useOrders";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { calculateOrderItemSubtotal } from "@shared/logic/order-calculations";
import type { Customer } from "@shared/models";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { CustomerSection } from "./-components/create/CustomerSection";
import { FormActions } from "./-components/create/FormActions";
import { OrderItemsSection } from "./-components/create/OrderItemsSection";
import {
  generateTempId,
  type CreateOrderItemInput,
  type OrderItemFormData,
} from "./-components/create/formTypes";

export const Route = createFileRoute("/orders/new")({
  beforeLoad: requireAuth,
  component: OrderNewPage,
});

function OrderNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateOrder();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemFormData[]>([]);

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

      // Validate order items
      if (orderItems.length === 0) {
        setSubmitError("請至少新增一筆明細項目");
        return;
      }

      // Validate each order item
      for (let i = 0; i < orderItems.length; i++) {
        const item = orderItems[i]!;
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
          orderItems: orderItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
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

  const handleAddOrderItem = useCallback((input: CreateOrderItemInput) => {
    setOrderItems((prev) => [
      ...prev,
      {
        tempId: generateTempId(),
        ...input,
      },
    ]);
  }, []);

  const handleRemoveOrderItem = useCallback((index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateOrderItem = useCallback(
    (index: number, input: CreateOrderItemInput) => {
      setOrderItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...input } : item)),
      );
    },
    [],
  );

  // Calculate total amount
  const totalAmount = orderItems.reduce(
    (sum, item) =>
      sum + calculateOrderItemSubtotal(item.quantity, item.unitPrice),
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
          <CustomerSection
            selectedCustomer={selectedCustomer}
            showError={form.state.isSubmitted && !selectedCustomer}
            onCustomerChange={handleCustomerChange}
          />

          <OrderItemsSection
            orderItems={orderItems}
            totalAmount={totalAmount}
            onAddOrderItem={handleAddOrderItem}
            onRemoveOrderItem={handleRemoveOrderItem}
            onUpdateOrderItem={handleUpdateOrderItem}
          />

          <FormActions
            isSubmitting={createMutation.isPending}
            onCancel={() => void navigate({ to: "/orders" })}
          />
        </Stack>
      </form>
    </Box>
  );
}
