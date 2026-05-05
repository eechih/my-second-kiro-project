# 實作計畫：客戶列表 UI 重構

## 概述

依據設計文件的架構決策，將客戶列表頁面從使用共用 `DataTable` 元件升級為獨立的 TanStack Table + MUI Table 實作，支援游標式分頁、批次選取、行操作按鈕、CSV 匯出及工具列整合。實作順序為：純函式 → Hooks → UI 元件 → 頁面整合。

## Tasks

- [ ] 1. 建立純函式工具模組
  - [ ] 1.1 建立 `src/lib/avatar-utils.ts`
    - 實作 `getAvatarColor(name: string): string`，從名稱字串衍生一致的十六進位背景色彩（`#RRGGBB`）
    - 實作 `getAvatarLetter(name: string): string`，回傳名稱的第一個字元
    - 空字串應回傳預設值（預設色彩及空字串）
    - _需求：2.3, 2.4_

  - [ ] 1.2 建立 `src/lib/table-utils.ts`
    - 實作 `getRowNumber(page: number, pageSize: number, rowIndex: number): number`，計算列號（page × pageSize + rowIndex + 1）
    - 實作客戶陣列排序函式 `sortCustomers(customers: Customer[], field: SortField): Customer[]`
    - 匯出 `SortField` 型別定義（`"name" | "contactPerson" | "phone" | "createdAt"`）
    - _需求：3.2, 1.5_

  - [ ] 1.3 建立 `src/lib/customer-csv.ts`
    - 實作 `generateCustomerCsv(customers: Customer[]): string`，產生含 UTF-8 BOM 的 CSV 字串
    - CSV 標題列：客戶名稱、聯絡人、電話、Email、地址、狀態、建立日期
    - 實作 `getCustomerCsvFilename(date?: Date): string`，產生 `customers_{YYYY-MM-DD}.csv` 格式檔名
    - 處理欄位值中的逗號與換行（以雙引號包裹）
    - _需求：7.1, 7.2, 7.3, 7.4_

  - [ ]\* 1.4 撰寫 `src/lib/__tests__/avatar-utils.property.test.ts` 屬性測試
    - **屬性 2：Avatar 衍生一致性**
    - 使用 fast-check 產生隨機中英文字串，驗證 `getAvatarLetter` 回傳第一個字元
    - 驗證 `getAvatarColor` 對相同輸入始終回傳相同的有效 `#RRGGBB` 格式色彩
    - **驗證：需求 2.3, 2.4**

  - [ ]\* 1.5 撰寫 `src/lib/__tests__/table-utils.property.test.ts` 屬性測試
    - **屬性 1：列號計算正確性**
    - 使用 fast-check 產生隨機 page（≥0）、pageSize（>0）、rowIndex（≥0），驗證結果為 `page × pageSize + rowIndex + 1` 且為正整數
    - **屬性 6：排序產生有序輸出**
    - 使用 fast-check 產生隨機客戶陣列與排序欄位，驗證排序後相鄰元素滿足 `a[field] <= b[field]`
    - **驗證：需求 3.2, 1.5**

  - [ ]\* 1.6 撰寫 `src/lib/__tests__/customer-csv.property.test.ts` 屬性測試
    - **屬性 5：CSV 匯出正確性**
    - 使用 fast-check 產生隨機客戶資料（含特殊字元），驗證：
      - 輸出以 `\uFEFF` 開頭
      - 包含標題列
      - 資料列數等於輸入客戶數量
      - 每列包含對應欄位值
    - **驗證：需求 7.1, 7.2, 7.3**

- [ ] 2. 建立游標分頁 Hook
  - [ ] 2.1 建立 `src/hooks/useCursorPagination.ts`
    - 實作 `useCursorPagination(initialPageSize?: number)` hook
    - 管理 `currentToken`、`pageSize`、`tokenStack` 狀態
    - 實作 `goNext(nextToken: string)`：將 currentToken push 到 tokenStack，設定新 currentToken
    - 實作 `goPrev()`：從 tokenStack pop 出前一個 token 作為 currentToken
    - 實作 `setPageSize(size: number)`：變更每頁筆數並重置分頁狀態
    - 實作 `reset()`：清空 tokenStack，currentToken 設為 undefined
    - 匯出 `CursorPaginationState` 與 `CursorPaginationActions` 介面
    - _需求：6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]\* 2.2 撰寫 `src/hooks/__tests__/useCursorPagination.property.test.ts` 屬性測試
    - **屬性 4：Token 堆疊行為**
    - 使用 fast-check 產生隨機導覽序列（goNext n 次），驗證 tokenStack 長度等於 n
    - 驗證連續 goPrev 以 LIFO 順序回傳先前 token
    - 驗證 reset 後 tokenStack 清空且 currentToken 為 undefined
    - **驗證：需求 6.5, 6.6**

- [ ] 3. 建立客戶列表資料查詢 Hook
  - [ ] 3.1 建立 `src/hooks/useCustomerListCursor.ts`
    - 實作 `useCustomerListCursor(params: CustomerListCursorParams)` hook
    - 使用 TanStack Query 的 `useQuery`，query key 包含所有參數
    - 呼叫 `client.models.Customer.list` 並傳入 `limit`、`nextToken`、`filter`
    - 回傳 `PaginatedResult<Customer>`（含 items、totalCount、nextToken）
    - 支援 `search`（name/contactPerson/phone 模糊搜尋）與 `isActive` 篩選
    - 匯出 `CustomerListCursorParams` 介面與 `StatusFilter` 型別
    - _需求：1.5, 6.4, 6.5_

- [ ] 4. Checkpoint - 確認純函式與 Hooks 正確
  - 確保所有測試通過，如有問題請詢問使用者。

- [ ] 5. 建立 UI 子元件
  - [ ] 5.1 建立 `src/routes/customers/components/CustomerToolbar.tsx`
    - 實作 `CustomerToolbar` 元件，接收 `CustomerToolbarProps`
    - 水平排列：搜尋輸入框（含 `搜尋 {N} 筆記錄...` 佔位文字）、Status_Filter（MUI Select，選項：全部狀態/啟用中/已停用）、Sort_Dropdown（MUI Select，選項：客戶名稱/聯絡人/電話/建立日期）、新增客戶按鈕（primary + AddIcon）、CSV 匯出 IconButton（下載圖示，匯出中顯示 CircularProgress）
    - _需求：1.1, 1.2, 1.3, 1.4, 1.6, 1.7_

  - [ ] 5.2 建立 `src/routes/customers/components/UserInfoCell.tsx`
    - 實作 `UserInfoCell` 元件，接收 `UserInfoCellProps`
    - 左側顯示 Avatar（使用 `getAvatarLetter` 與 `getAvatarColor`）
    - 右側顯示客戶名稱（Typography subtitle2 粗體）與聯絡人（Typography body2 次要色彩）
    - _需求：2.1, 2.2, 2.3, 2.4_

  - [ ] 5.3 建立 `src/routes/customers/components/CursorPagination.tsx`
    - 實作 `CursorPagination` 元件，接收 `CursorPaginationProps`
    - 顯示「每頁筆數」下拉選單（10/25/50）、「顯示 {count} 筆」文字、上一頁/下一頁按鈕
    - 按鈕啟用/停用狀態依據 `hasNextPage` 與 `hasPrevPage` props
    - _需求：6.1, 6.2, 6.3, 6.7_

  - [ ] 5.4 建立 `src/routes/customers/components/RowActions.tsx`
    - 實作 `RowActions` 元件，接收 `RowActionsProps`
    - 顯示三個 IconButton：檢視（VisibilityIcon）、編輯（EditIcon）、啟用/停用（BlockIcon warning 或 CheckCircleIcon success）
    - _需求：4.1, 4.6_

  - [ ]\* 5.5 撰寫 `src/routes/customers/__tests__/CustomerToolbar.test.tsx` 單元測試
    - 測試工具列渲染所有元素
    - 測試搜尋輸入框佔位文字包含總筆數
    - 測試篩選下拉選單選項
    - 測試匯出按鈕載入狀態
    - _需求：1.1, 1.3, 1.4, 1.6, 1.7_

  - [ ]\* 5.6 撰寫 `src/routes/customers/__tests__/UserInfoCell.test.tsx` 單元測試
    - 測試 Avatar 顯示名稱第一個字元
    - 測試客戶名稱與聯絡人文字渲染
    - _需求：2.1, 2.2_

  - [ ]\* 5.7 撰寫 `src/routes/customers/__tests__/CursorPagination.test.tsx` 單元測試
    - 測試每頁筆數選項
    - 測試按鈕啟用/停用狀態
    - 測試顯示筆數文字
    - _需求：6.1, 6.2, 6.3, 6.7_

  - [ ]\* 5.8 撰寫 `src/routes/customers/__tests__/RowActions.test.tsx` 單元測試
    - 測試啟用中客戶顯示停用按鈕（warning 色彩）
    - 測試已停用客戶顯示啟用按鈕（success 色彩）
    - 測試按鈕點擊觸發對應 callback
    - _需求：4.1, 4.6_

- [ ] 6. Checkpoint - 確認 UI 子元件正確
  - 確保所有測試通過，如有問題請詢問使用者。

- [ ] 7. 重構客戶列表頁面
  - [ ] 7.1 重構 `src/routes/customers/index.tsx` — 整合所有新元件
    - 移除對共用 `DataTable` 的依賴，改用 TanStack Table + MUI Table 直接渲染
    - 加入麵包屑導覽（首頁 / 客戶 / 列表）與頁面標題（Typography h5「列表」）
    - 整合 `CustomerToolbar`、`UserInfoCell`、`CursorPagination`、`RowActions`
    - 使用 `useCursorPagination` hook 管理分頁狀態
    - 使用 `useCustomerListCursor` hook 取得資料
    - 實作批次選取邏輯（全選/單選/不確定狀態）
    - 表格欄位順序：核取方塊、列號（#）、客戶資訊、電話、Email、地址、狀態（彩色文字）、操作
    - 狀態欄位以綠色（success.main）顯示「啟用中」，紅色（error.main）顯示「已停用」
    - 行操作：檢視導覽至 `/customers/$customerId`、編輯導覽至 `/customers/$customerId` 帶編輯參數、停用/啟用顯示確認對話框
    - CSV 匯出：呼叫 `generateCustomerCsv` 產生檔案並觸發下載
    - 篩選/搜尋/每頁筆數變更時重置分頁狀態
    - _需求：1.1–1.7, 2.1–2.4, 3.1–3.4, 4.1–4.6, 5.1–5.4, 6.1–6.7, 7.1–7.5, 8.1–8.3_

  - [ ]\* 7.2 撰寫選取狀態屬性測試 `src/hooks/__tests__/useSelection.property.test.ts`
    - **屬性 3：選取狀態一致性**
    - 使用 fast-check 產生隨機列集合與選取操作序列
    - 驗證全選後所有列選取狀態為 true
    - 驗證單列切換僅影響該列
    - 驗證 0 < 已選取數 < 總列數時為不確定狀態
    - **驗證：需求 5.1, 5.2, 5.4**

  - [ ]\* 7.3 撰寫 `src/routes/customers/__tests__/Breadcrumb.test.tsx` 單元測試
    - 測試麵包屑顯示「首頁 / 客戶 / 列表」
    - 測試「首頁」連結導覽至 `/`
    - 測試頁面標題顯示「列表」
    - _需求：8.1, 8.2, 8.3_

- [ ] 8. 最終 Checkpoint - 確認所有功能整合正確
  - 確保所有測試通過，如有問題請詢問使用者。

## 備註

- 標記 `*` 的任務為選擇性任務，可跳過以加速 MVP 開發
- 每個任務皆參照具體需求編號以確保可追溯性
- Checkpoint 任務確保漸進式驗證
- 屬性測試驗證通用正確性屬性（使用 fast-check，每個屬性至少 100 次迭代）
- 單元測試驗證特定範例與邊界情況
- 不修改共用 `DataTable` 元件，客戶列表頁面使用獨立的 TanStack Table + MUI Table 實作
- 游標式分頁使用 token 堆疊管理上一頁導覽
- 純函式抽離至 `src/lib/` 以便獨立測試
