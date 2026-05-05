import type { Customer } from "../../shared/models/customer";

const CSV_HEADERS = [
  "客戶名稱",
  "聯絡人",
  "電話",
  "Email",
  "地址",
  "狀態",
  "建立日期",
] as const;

const UTF8_BOM = "\uFEFF";

/**
 * 將欄位值包裹為安全的 CSV 欄位。
 * 若值包含逗號、換行或雙引號，以雙引號包裹並將內部雙引號轉義為兩個雙引號。
 */
function escapeCsvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes('"')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 產生客戶列表 CSV 字串（含 UTF-8 BOM）。
 *
 * CSV 標題列：客戶名稱、聯絡人、電話、Email、地址、狀態、建立日期
 *
 * @param customers - 客戶資料陣列
 * @returns 含 BOM 的 CSV 字串
 */
export function generateCustomerCsv(customers: Customer[]): string {
  const headerRow = CSV_HEADERS.join(",");

  const dataRows = customers.map((customer) => {
    const fields = [
      escapeCsvField(customer.name),
      escapeCsvField(customer.contactPerson),
      escapeCsvField(customer.phone),
      escapeCsvField(customer.email),
      escapeCsvField(customer.address),
      customer.isActive ? "啟用中" : "已停用",
      escapeCsvField(customer.createdAt),
    ];
    return fields.join(",");
  });

  return UTF8_BOM + [headerRow, ...dataRows].join("\n");
}

/**
 * 產生 CSV 匯出檔案名稱，格式為 `customers_{YYYY-MM-DD}.csv`。
 *
 * @param date - 日期物件，預設為當天
 * @returns 檔案名稱字串
 */
export function getCustomerCsvFilename(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `customers_${year}-${month}-${day}.csv`;
}
