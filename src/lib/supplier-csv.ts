import type { Supplier } from "../../shared/models/supplier";

const CSV_HEADERS = [
  "供應商名稱",
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
 * 產生供應商列表 CSV 字串（含 UTF-8 BOM）。
 *
 * CSV 標題列：供應商名稱、聯絡人、電話、Email、地址、狀態、建立日期
 *
 * @param suppliers - 供應商資料陣列
 * @returns 含 BOM 的 CSV 字串
 */
export function generateSupplierCsv(suppliers: Supplier[]): string {
  const headerRow = CSV_HEADERS.join(",");

  const dataRows = suppliers.map((supplier) => {
    const fields = [
      escapeCsvField(supplier.name),
      escapeCsvField(supplier.contactPerson),
      escapeCsvField(supplier.phone),
      escapeCsvField(supplier.email),
      escapeCsvField(supplier.address),
      supplier.isActive ? "啟用中" : "已停用",
      escapeCsvField(supplier.createdAt),
    ];
    return fields.join(",");
  });

  return UTF8_BOM + [headerRow, ...dataRows].join("\n");
}

/**
 * 產生 CSV 匯出檔案名稱，格式為 `suppliers_{YYYY-MM-DD}.csv`。
 *
 * @param date - 日期物件，預設為當天
 * @returns 檔案名稱字串
 */
export function getSupplierCsvFilename(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `suppliers_${year}-${month}-${day}.csv`;
}
