import { formatCurrency } from "@/lib/currency";
import type { Order, OrderItem } from "@shared/models";
import { formatOrderDate } from "./tableUtils";

export interface PackingSlipOptions {
  itemFilter?: (item: OrderItem) => boolean;
  emptyMessage?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const date = formatOrderDate(value);
  const time = formatTime(value);
  return time ? `${date} ${time}` : date;
}

function formatTime(value: string): string {
  try {
    return new Date(value).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

export function buildPackingSlipHtml(
  orders: readonly Order[],
  options: PackingSlipOptions = {},
): string {
  const {
    itemFilter = (item: OrderItem) => Boolean(item.shippedAt),
    emptyMessage = "沒有商品需要出貨",
  } = options;
  const printedAt = new Date().toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const slips = orders
    .map((order) => {
      const shippingOrderItems = order.items.filter(itemFilter);
      const rows =
        shippingOrderItems.length > 0
          ? shippingOrderItems
              .map((item) => {
                const productLabel = item.variantLabel
                  ? `${item.productName} (${item.variantLabel})`
                  : item.productName;

                return `
            <tr>
              <td>
                <div class="item-name">${escapeHtml(productLabel)}</div>
              </td>
              <td class="number">${item.quantity.toLocaleString("zh-TW")}</td>
              <td class="number">${escapeHtml(formatCurrency(item.unitPrice))}</td>
              <td class="number">${escapeHtml(formatCurrency(item.subtotal))}</td>
              <td class="check-cell"></td>
              <td class="check-cell"></td>
            </tr>
          `;
              })
              .join("")
          : `
            <tr>
              <td class="empty-message" colspan="6">${escapeHtml(emptyMessage)}</td>
            </tr>
          `;

      const totalQuantity = shippingOrderItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const totalAmount = shippingOrderItems.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );

      return `
        <section class="slip">
          <div class="info-grid">
            <div>
              <span>客戶：</span>
              <span>${escapeHtml(order.customerName)}</span>
            </div>
            <div>
              <span>購買日期：</span>
              <span>${escapeHtml(formatDateTime(order.createdAt))}</span>
            </div>
            <div class="info-right packing-slip-number">
              <span>出貨單</span>
              <span>${escapeHtml(order.orderNumber)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>商品</th>
                <th class="number">數量</th>
                <th class="number">單價</th>
                <th class="number">小計</th>
                <th class="check-cell">撿貨</th>
                <th class="check-cell">覆核</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="summary">
            <div class="summary-left">
              <div class="printed-at">列印日期：${escapeHtml(printedAt)}</div>
            </div>
            <div class="summary-right">
              <div>品項數：${shippingOrderItems.length.toLocaleString("zh-TW")}</div>
              <div>總數量：${totalQuantity.toLocaleString("zh-TW")}</div>
              <div>訂單金額：${escapeHtml(formatCurrency(totalAmount))}</div>
            </div>
          </div>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <title>出貨單</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111827;
        background: #f7f7f5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        font-weight: 400;
      }
      .slip {
        width: 210mm;
        margin: 0 auto 16px;
        padding: 8mm;
        background: #fff;
        border-bottom: 1px dashed #9ca3af;
      }
      .slip:last-child { border-bottom: 0; }
      .slip-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        padding-bottom: 16px;
      }
      .slip-title {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .muted {
        margin: 0;
        color: #9ca3af;
      }
      .info-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px 28px;
        margin-bottom: 8px;
      }
      .info-right { text-align: right; }
      .packing-slip-number {
        color: #CCCCCC;
        font-size: 12px;
      }
      .write-line {
        display: block;
        height: 22px;
        border-bottom: 1px solid #9ca3af;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 9px 8px;
        border: 1px solid #d1d5db;
        vertical-align: top;
      }
      th {
        background: #f3f4f6;
        text-align: left;
        font-weight: 400;
      }
      .center { text-align: center; }
      .number { text-align: right; }
      .check-cell {
        width: 38px;
        padding: 9px 4px;
      }
      .empty-message {
        color: #6b7280;
        text-align: center;
      }
      .item-name { font-weight: 400; }
      .summary {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        margin-top: 14px;
        font-weight: 400;
      }
      .summary-left,
      .summary-right {
        display: flex;
        gap: 20px;
        align-items: center;
      }
      .summary-right { justify-content: flex-end; }
      .printed-at {
        color: #CCCCCC;
        font-size: 12px;
      }
      @page {
        size: A4;
        margin: 0;
      }
      @media print {
        body { background: #fff; }
        .slip {
          width: auto;
          min-height: auto;
          margin: 0;
          padding: 6mm;
        }
      }
    </style>
  </head>
  <body>${slips}</body>
</html>`;
}

export function printPackingSlips(
  orders: readonly Order[],
  options: PackingSlipOptions = {},
): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(buildPackingSlipHtml(orders, options));
  printWindow.document.close();
  printWindow.focus();
  return true;
}
