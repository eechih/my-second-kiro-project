# 實作計畫：供應商列表 UI 重構

## 概述

依據設計文件的架構決策，將供應商列表頁面從使用共用 `DataTable` 元件升級為獨立的 TanStack Table + MUI Table 實作，支援游標式分頁、批次選取、行操作按鈕、CSV 匯出及工具列整合。實作順序為：純函式 → Hooks → UI 元件 → 頁面整合。

複用既有的 `useCursorPagination` hook、`getAvatarColor`、`getAvatarLetter`、`getRowNumber` 工具函式，僅新增供應商專用的 CSV 模組、資料查詢 hook 及 UI 元件。

## Tasks

- [x] 1. 建立供應商 CSV 純函式模組
  - [x] 1.1 建立 `src/lib/supplier-csv.ts`
    - 實作 `generateSupplierCsv(suppliers: Supplier[]): string`，產生含 UTF-8 BOM 的 CSV 字串
    - CSV 標題列：供應商名稱、聯絡人、電話、Email、地址、狀態、建立日期
    - 實作 `getSupplierCsvFilename(date?: Date): string`，產生 `suppliers_{YYYY-MM-DD}.csv` 格式檔名
    - 處理欄位值中的逗號、換行與雙引號（以雙引號包裹並轉義）
    - 結構參考 `src/lib/customer-csv.ts`
    - _需求：7.1, 7.2, 7.3, 7.4_

  - [ ]\* 1.2 撰寫 `src/lib/__tests__/supplier-csv.property.test.ts` 屬性測試
    - **屬性 5：CSV 匯出正確性**
    - 使用 fast-check 產生隨機供應商資料（含特殊字元：逗號、換行、雙引號），驗證：
      - 輸出以 `\uFEFF` 開頭
      - 包含標題列（供應商名稱、聯絡人、電話、Email、地址、狀態、建立日期）
      - 資料列數等於輸入供應商數量
      - 每列包含對應欄位值
    - **驗證：需求 7.1, 7.2, 7.3**

  - [ ]\* 1.3 撰寫 `src/lib/__tests__/supplier-csv.test.ts` 單元測試
    - 測試空陣列回傳僅含 BOM 與標題列的字串
    - 測試檔案名稱格式為 `suppliers_{YYYY-MM-DD}.csv`
    - 測試狀態欄位正確顯示「啟用中」或「已停用」
    - _需求：7.4, 7.5, 7.6_

  - [ ]\* 1.4 撰寫 `src/lib/__tests__/supplier-sort.property.test.ts` 屬性測試
    - **屬性 6：排序產生有序輸出**
    - 使用 fast-check 產生隨機供應商陣列與排序欄位（name/contactPerson/phone/createdAt）
    - 驗證排序後相鄰元素滿足 `a[field] <= b[field]`（依字串比較）
    - **驗證：需求 1.6, 9.5**

- [x] 2. 建立供應商列表資料查詢 Hook
  - [x] 2.1 建立 `src/hooks/useSupplierListCursor.ts`
    - 實作 `useSupplierListCursor(params: SupplierListCursorParams)` hook
    - 使用 TanStack Query 的 `useQuery`，query key 包含所有參數
    - 呼叫 `client.models.Supplier.list` 並傳入 `limit`、`nextToken`、`filter`
    - 回傳 `PaginatedResult<Supplier>`（含 items、totalCount、nextToken）
    - 支援 `search`（name/contactPerson/phone 模糊搜尋）與 `isActive` 篩選
    - 客戶端依 `sortField` 排序（使用 `sortCustomers` 的相同模式）
    - 匯出 `SupplierListCursorParams` 介面、`StatusFilter` 型別及 `SupplierSortField` 型別
    - 結構參考 `src/hooks/useCustomerListCursor.ts`
    - _需求：9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 3. Checkpoint - 確認純函式與 Hook 正確
  - 確保所有測試通過，如有問題請詢問使用者。

- [x] 4. 建立 UI 子元件
  - [x] 4.1 建立 `src/routes/suppliers/-components/SupplierToolbar.tsx`
    - 實作 `SupplierToolbar` 元件，接收 `SupplierToolbarProps`
    - 水平排列：搜尋輸入框（含 `搜尋 {N} 筆記錄...` 佔位文字、300ms 防抖）、Status_Filter（MUI Select：全部狀態/啟用中/已停用）、Sort_Dropdown（MUI Select：供應商名稱/聯絡人/電話/建立日期）、新增供應商按鈕（primary + AddIcon）、CSV 匯出 IconButton（FileDownloadIcon，匯出中顯示 CircularProgress）
    - 結構參考 `src/routes/customers/-components/CustomerToolbar.tsx`
    - _需求：1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8_

  - [x] 4.2 建立 `src/routes/suppliers/-components/SupplierInfoCell.tsx`
    - 實作 `SupplierInfoCell` 元件，接收 `SupplierInfoCellProps`
    - 左側顯示 Avatar（使用 `getAvatarLetter` 與 `getAvatarColor`）
    - 右側顯示供應商名稱（Typography subtitle2 粗體）與聯絡人（Typography body2 次要色彩）
    - 結構參考 `src/routes/customers/-components/UserInfoCell.tsx`
    - _需求：2.1, 2.2, 2.3, 2.4_

  - [x] 4.3 建立 `src/routes/suppliers/-components/CursorPagination.tsx`
    - 實作 `CursorPagination` 元件，接收 `CursorPaginationProps`
    - 顯示「每頁筆數」下拉選單（10/25/50）、「顯示 {count} 筆」文字、上一頁/下一頁按鈕
    - 結構參考 `src/routes/customers/-components/CursorPagination.tsx`
    - _需求：6.1, 6.2, 6.3, 6.7_

  - [x] 4.4 建立 `src/routes/suppliers/-components/SupplierRowActions.tsx`
    - 實作 `SupplierRowActions` 元件，接收 `SupplierRowActionsProps`
    - 顯示三個 IconButton：檢視（VisibilityIcon）、編輯（EditIcon）、啟用/停用（啟用中顯示 BlockIcon warning 色彩，已停用顯示 CheckCircleIcon success 色彩）
    - 結構參考 `src/routes/customers/-components/RowActions.tsx`
    - _需求：4.1, 4.6_

  - [ ]\* 4.5 撰寫 `src/routes/suppliers/__tests__/SupplierToolbar.test.tsx` 單元測試
    - 測試工具列渲染所有元素
    - 測試搜尋輸入框佔位文字包含總筆數
    - 測試篩選下拉選單選項（全部狀態/啟用中/已停用）
    - 測試排序下拉選單選項（供應商名稱/聯絡人/電話/建立日期）
    - 測試匯出按鈕載入狀態
    - _需求：1.1, 1.2, 1.4, 1.5, 1.7, 1.8_

  - [ ]\* 4.6 撰寫 `src/routes/suppliers/__tests__/SupplierInfoCell.test.tsx` 單元測試
    - 測試 Avatar 顯示名稱第一個字元
    - 測試供應商名稱與聯絡人文字渲染
    - _需求：2.1, 2.2_

  - [ ]\* 4.7 撰寫 `src/routes/suppliers/__tests__/CursorPagination.test.tsx` 單元測試
    - 測試每頁筆數選項（10/25/50）
    - 測試按鈕啟用/停用狀態
    - 測試顯示筆數文字
    - _需求：6.1, 6.2, 6.3, 6.7_

  - [ ]\* 4.8 撰寫 `src/routes/suppliers/__tests__/SupplierRowActions.test.tsx` 單元測試
    - 測試啟用中供應商顯示停用按鈕（warning 色彩）
    - 測試已停用供應商顯示啟用按鈕（success 色彩）
    - 測試按鈕點擊觸發對應 callback
    - _需求：4.1, 4.6_

- [x] 5. Checkpoint - 確認 UI 子元件正確
  - 確保所有測試通過，如有問題請詢問使用者。

- [x] 6. 重構供應商列表頁面
  - [x] 6.1 重構 `src/routes/suppliers/index.tsx` — 整合所有新元件
    - 移除對共用 `DataTable`、`SearchBar`、`ToggleButtonGroup` 的依賴
    - 改用 TanStack Table + MUI Table 直接渲染
    - 加入麵包屑導覽（首頁 / 供應商 / 列表）與頁面標題（Typography h5「列表」）
    - 整合 `SupplierToolbar`、`SupplierInfoCell`、`CursorPagination`、`SupplierRowActions`
    - 使用既有 `useCursorPagination` hook 管理分頁狀態
    - 使用新建 `useSupplierListCursor` hook 取得資料
    - 實作批次選取邏輯（全選/單選/不確定狀態）
    - 表格欄位順序：核取方塊、列號（#）、供應商資訊、電話、Email、地址、狀態（彩色文字）、操作
    - 狀態欄位以綠色（success.main）顯示「啟用中」，紅色（error.main）顯示「已停用」
    - 行操作：檢視導覽至 `/suppliers/$supplierId`、編輯導覽至 `/suppliers/$supplierId` 帶編輯參數、停用/啟用顯示確認對話框
    - CSV 匯出：呼叫 `generateSupplierCsv` 產生檔案並觸發下載
    - 篩選/搜尋/每頁筆數變更時重置分頁狀態
    - 結構參考 `src/routes/customers/index.tsx`
    - _需求：1.1–1.8, 2.1–2.4, 3.1–3.4, 4.1–4.6, 5.1–5.4, 6.1–6.7, 7.1–7.6, 8.1–8.3_

  - [ ]\* 6.2 撰寫 `src/routes/suppliers/__tests__/Breadcrumb.test.tsx` 單元測試
    - 測試麵包屑顯示「首頁 / 供應商 / 列表」
    - 測試「首頁」連結導覽至 `/`
    - 測試頁面標題顯示「列表」
    - _需求：8.1, 8.2, 8.3_

- [x] 7. 最終 Checkpoint - 確認所有功能整合正確
  - 確保所有測試通過，如有問題請詢問使用者。

## 備註

- 標記 `*` 的任務為選擇性任務，可跳過以加速 MVP 開發
- 每個任務皆參照具體需求編號以確保可追溯性
- Checkpoint 任務確保漸進式驗證
- 屬性測試驗證通用正確性屬性（使用 fast-check，每個屬性至少 100 次迭代）
- 單元測試驗證特定範例與邊界情況
- 不修改共用 `DataTable` 元件，供應商列表頁面使用獨立的 TanStack Table + MUI Table 實作
- 複用既有 `useCursorPagination` hook（不重新建立）
- 複用既有 `getAvatarColor`、`getAvatarLetter`（`src/lib/avatar-utils.ts`）及 `getRowNumber`（`src/lib/table-utils.ts`）
- 供應商專用元件放置於 `src/routes/suppliers/-components/`（`-` 前綴為 TanStack Router 非路由目錄慣例）
