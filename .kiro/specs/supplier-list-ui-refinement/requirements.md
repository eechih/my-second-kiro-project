# 需求文件

## 簡介

本規格定義供應商列表頁面的 UI 佈局重構需求，以已完成的客戶列表頁面重構為設計參考，將現有使用共用 `DataTable` 元件的供應商列表頁面升級為獨立的 TanStack Table + MUI Table 實作，具備游標式分頁、整合式工具列、複合資訊欄位、行操作按鈕、批次選取及 CSV 匯出等功能。

## 術語表

- **Supplier_List_Page**: 供應商列表頁面元件，位於 `src/routes/suppliers/index.tsx`，負責顯示供應商資料表格及相關操作
- **Toolbar**: 頁面頂部的工具列區域，包含搜尋框、篩選下拉選單、排序下拉選單、新增按鈕及匯出按鈕
- **Supplier_Info_Cell**: 表格中合併顯示供應商名稱與聯絡人資訊的複合儲存格，含 Avatar 元件
- **Status_Text**: 以彩色文字顯示供應商啟用狀態的呈現方式
- **Row_Actions**: 每列資料末端的操作圖示按鈕群組（檢視、編輯、停用/啟用）
- **Bulk_Selection**: 透過核取方塊選取多列資料以進行批次操作的功能
- **Pagination_Control**: 表格底部的分頁控制元件，採用游標式分頁（基於 DynamoDB nextToken），包含每頁筆數選擇及上一頁/下一頁導覽按鈕
- **Status_Filter**: 工具列中用於篩選供應商啟用狀態的下拉選單元件
- **Sort_Dropdown**: 工具列中用於選擇排序欄位的下拉選單元件
- **CSV_Export**: 將目前篩選結果匯出為 CSV 檔案的功能
- **Cursor_Pagination**: 基於 DynamoDB nextToken 的分頁機制，使用本地 token 堆疊支援上一頁導覽

## 需求

### 需求 1：工具列佈局重構

**使用者故事：** 身為系統操作人員，我希望工具列將搜尋、篩選、排序、新增及匯出功能整合在同一列，以便快速存取所有列表操作而不需要在多個區域之間切換。

#### 驗收條件

1. Supplier_List_Page 應顯示單列式 Toolbar，由左至右水平排列搜尋輸入框、Status_Filter 下拉選單、Sort_Dropdown、新增供應商按鈕及 CSV_Export 圖示按鈕。
2. 頁面載入時，Toolbar 的搜尋輸入框應顯示包含總筆數的佔位文字，格式為「搜尋 {N} 筆記錄...」。
3. WHEN 使用者在搜尋輸入框中輸入文字時，THE Supplier_List_Page SHALL 在 300 毫秒的防抖延遲後觸發搜尋查詢。
4. Status_Filter 應提供「全部狀態」、「啟用中」及「已停用」三個選項，以 MUI Select 下拉選單元件取代現有的 ToggleButtonGroup。
5. Sort_Dropdown 應提供排序選項，包含「供應商名稱」、「聯絡人」、「電話」及「建立日期」，以 MUI Select 下拉選單元件呈現。
6. WHEN Sort_Dropdown 的值變更時，THE Supplier_List_Page SHALL 依所選欄位重新排序顯示的資料。
7. 新增供應商按鈕應顯示「新增供應商」文字，使用 primary 色彩變體並帶有加號圖示。
8. CSV_Export 按鈕應以 IconButton 呈現，使用下載/匯出圖示，位於新增供應商按鈕之後。

### 需求 2：供應商資訊複合欄位

**使用者故事：** 身為系統操作人員，我希望供應商名稱與聯絡人資訊合併顯示在同一欄位中，以便在有限的表格空間內快速辨識供應商身份。

#### 驗收條件

1. THE Supplier_List_Page SHALL 顯示一個「供應商資訊」欄位，將供應商名稱與聯絡人合併於同一個表格儲存格中。
2. Supplier_Info_Cell 應將供應商名稱以粗體文字（Typography variant subtitle2）顯示於第一行，聯絡人名稱以次要色彩文字（Typography variant body2）顯示於第二行。
3. Supplier_Info_Cell 應在文字內容左側顯示圓形 Avatar 元件，顯示供應商名稱的第一個字元。
4. Avatar 元件應使用由供應商名稱字串衍生的一致背景色彩，使用既有的 `getAvatarColor` 工具函式。

### 需求 3：表格欄位結構

**使用者故事：** 身為系統操作人員，我希望表格欄位結構經過重新設計，以便在一個畫面中看到最重要的供應商資訊。

#### 驗收條件

1. THE Supplier_List_Page SHALL 依以下順序顯示欄位：Bulk_Selection 核取方塊、列號（#）、Supplier_Info_Cell（供應商資訊）、電話、Email、地址、Status_Text（狀態）及 Row_Actions（操作）。
2. 列號欄位應顯示從 1 開始的連續編號，依據目前頁碼與每頁筆數計算（page × pageSize + rowIndex + 1），使用既有的 `getRowNumber` 工具函式。
3. Status_Text 應以綠色（success.main）顯示「啟用中」代表啟用供應商，以紅色（error.main）顯示「已停用」代表停用供應商。
4. THE Supplier_List_Page SHALL 使用 TanStack Table 搭配 MUI Table 元件渲染表格，取代現有的共用 DataTable 元件。

### 需求 4：行操作按鈕

**使用者故事：** 身為系統操作人員，我希望每列資料提供檢視、編輯及停用/啟用的操作按鈕，以便直接從列表頁面執行常用操作。

#### 驗收條件

1. Row_Actions 欄位應為每列顯示三個圖示按鈕：檢視（眼睛圖示）、編輯（鉛筆圖示）及啟用/停用（切換圖示）。
2. WHEN 檢視按鈕被點擊時，THE Supplier_List_Page SHALL 導覽至供應商詳情頁面，路由為「/suppliers/$supplierId」。
3. WHEN 編輯按鈕被點擊時，THE Supplier_List_Page SHALL 導覽至供應商編輯頁面，路由為「/suppliers/$supplierId」並帶有編輯模式參數。
4. WHEN 停用按鈕被點擊（針對啟用中的供應商）時，THE Supplier_List_Page SHALL 顯示確認對話框後再執行停用操作。
5. WHEN 啟用按鈕被點擊（針對已停用的供應商）時，THE Supplier_List_Page SHALL 顯示確認對話框後再執行啟用操作。
6. 啟用/停用按鈕應為啟用中的供應商顯示禁止圖示（warning 色彩），為已停用的供應商顯示勾選圖示（success 色彩）。

### 需求 5：批次選取功能

**使用者故事：** 身為系統操作人員，我希望能透過核取方塊選取多筆供應商資料，以便未來支援批次操作（如批次停用）。

#### 驗收條件

1. THE Supplier_List_Page SHALL 在標題列顯示一個核取方塊，點擊時可選取或取消選取所有可見列。
2. THE Supplier_List_Page SHALL 在每個資料列顯示一個核取方塊，點擊時可選取或取消選取該列。
3. WHEN 一列或多列被選取時，THE Supplier_List_Page SHALL 以醒目背景色彩標示已選取列的視覺狀態。
4. WHEN 標題列核取方塊處於不確定狀態（部分列被選取）時，THE 核取方塊 SHALL 顯示不確定狀態的視覺指示。

### 需求 6：游標式分頁

**使用者故事：** 身為系統操作人員，我希望分頁元件提供上一頁/下一頁的導覽功能，以便在資料列表中逐頁瀏覽供應商資料。

#### 驗收條件

1. Pagination_Control 應顯示「每頁筆數」下拉選單，提供 10、25 及 50 的選項。
2. WHEN 後端回傳 nextToken 時，THE Pagination_Control SHALL 啟用「下一頁」按鈕；否則停用該按鈕。
3. WHEN 存在前一頁的 token 歷史記錄時，THE Pagination_Control SHALL 啟用「上一頁」按鈕；否則停用該按鈕。
4. WHEN 使用者點擊「下一頁」時，THE Supplier_List_Page SHALL 使用後端回傳的 nextToken 作為參數請求下一頁資料。
5. WHEN 使用者點擊「上一頁」時，THE Supplier_List_Page SHALL 從本地維護的 token 堆疊中取出前一頁的 token 請求該頁資料。
6. WHEN 使用者變更每頁筆數或篩選條件時，THE Supplier_List_Page SHALL 重置分頁狀態（清除 token 堆疊，從第一頁重新載入）。
7. Pagination_Control 應顯示目前頁面的筆數資訊，格式為「顯示 {count} 筆」。

### 需求 7：CSV 匯出功能

**使用者故事：** 身為系統操作人員，我希望能將目前篩選後的供應商列表匯出為 CSV 檔案，以便在外部工具中進行進一步分析或備份。

#### 驗收條件

1. WHEN CSV_Export 按鈕被點擊時，THE Supplier_List_Page SHALL 產生包含所有目前頁面資料的 CSV 檔案。
2. CSV 檔案應包含以下欄位：供應商名稱、聯絡人、電話、Email、地址、狀態、建立日期。
3. THE CSV_Export SHALL 使用 UTF-8 編碼並帶有 BOM，以確保繁體中文字元在試算表應用程式中正確顯示。
4. CSV 檔案應以「suppliers\_{YYYY-MM-DD}.csv」格式命名，使用當天日期。
5. WHILE 匯出進行中，THE CSV_Export 按鈕 SHALL 顯示載入指示器並停用，以防止重複匯出。
6. IF 目前頁面無資料可匯出，THEN THE Supplier_List_Page SHALL 顯示提示訊息「目前無資料可匯出」。

### 需求 8：頁面標題與麵包屑

**使用者故事：** 身為系統操作人員，我希望頁面頂部顯示麵包屑導覽路徑，以便了解目前所在位置並快速返回上層頁面。

#### 驗收條件

1. THE Supplier_List_Page SHALL 在頁面標題上方顯示麵包屑導覽，呈現「首頁 / 供應商 / 列表」。
2. WHEN「首頁」麵包屑連結被點擊時，THE Supplier_List_Page SHALL 導覽至儀表板頁面，路由為「/」。
3. THE Supplier_List_Page SHALL 在麵包屑下方以 Typography variant h5 顯示「列表」作為頁面標題。

### 需求 9：資料查詢 Hook 重構

**使用者故事：** 身為開發人員，我希望供應商列表查詢 hook 支援游標式分頁參數，以便與新的分頁元件整合。

#### 驗收條件

1. THE useSupplierListCursor hook SHALL 接受 pageSize、nextToken、search、isActive 及 sortField 參數。
2. WHEN nextToken 參數被提供時，THE useSupplierListCursor hook SHALL 將其傳遞給 Amplify Client 的 list 方法以取得對應頁面的資料。
3. THE useSupplierListCursor hook SHALL 回傳包含 items、totalCount 及 nextToken 的 PaginatedResult 物件。
4. WHEN search 參數被提供時，THE useSupplierListCursor hook SHALL 對供應商名稱、聯絡人及電話欄位進行模糊比對篩選。
5. WHEN sortField 參數被提供時，THE useSupplierListCursor hook SHALL 在客戶端依指定欄位對結果進行升序排序。
