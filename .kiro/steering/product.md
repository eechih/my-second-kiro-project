---
inclusion: always
---

# 產品概述

基於 AWS Amplify Gen2（Cognito）的 React SPA，提供電子商務訂單管理系統。所有使用者介面文字使用**繁體中文**。

系統以訂單為核心，整合進貨採購與出貨流程。核心業務流程：客戶下單 → 依訂單明細進貨採購 → 入庫確認（庫存增加）→ 出貨（庫存扣減）→ 訂單完成。

## 核心功能

- **驗證** — Email/密碼註冊（含驗證碼確認）、登入、登出（Cognito）
- **客戶管理** — 客戶基本資料 CRUD、搜尋，訂單建立時從客戶清單選取
- **供應商管理** — 供應商基本資料 CRUD、搜尋，進貨採購時從供應商清單選取
- **商品管理** — 商品基本資料 CRUD、搜尋、多張照片上傳（S3）、多維度規格組合（如顏色×尺寸）
- **訂單管理** — 訂單 CRUD、明細項目狀態追蹤、進貨採購/入庫、出貨/庫存扣減、訂單合併與分拆
- **儀表板** — 待處理訂單、待入庫採購、待出貨明細的摘要數量

## 業務領域概念

- **商品規格組合（Product Variant）**：商品可定義多組規格維度（如顏色、尺寸），系統自動產生笛卡爾積組合。每個組合有獨立 SKU、庫存、可選的單價/成本覆寫。
- **訂單明細狀態**：待處理 → 已訂購 → 已收到 → 已出貨（或待處理/已訂購 → 缺貨）。狀態轉換驅動訂單層級狀態自動更新。
- **訂單狀態**：pending → confirmed → shipping → completed（或任何狀態 → cancelled）。任一明細出貨後自動變為 shipping，全部出貨後自動變為 completed。
- **庫存追蹤**：在規格組合層級操作。進貨入庫增加庫存，出貨扣減庫存。無規格組合的商品在商品層級操作。
- **訂單合併/分拆**：同一客戶的未出貨訂單可合併為一筆或分拆為多筆，數量守恆。

## 驗證架構

驗證狀態由 `src/auth/AuthProvider.tsx` 中的 `AuthProvider` 集中管理，透過 React Context 提供給整個應用程式。

`AuthContext` 介面提供：

- `isAuthenticated`、`isLoading` — 驗證狀態旗標
- `user`（`AuthUser | null`）、`userAttributes`（`Record<string, string | undefined> | null`）— 使用者資料
- `signInWithEmail`、`signUpWithEmail`、`confirmSignUp`、`signOut` — 驗證操作方法

路由元件透過 `Route.useRouteContext()` 取得 `auth` 物件。不要引入其他驗證機制或額外的 auth context。

## 路由與存取控制

所有管理頁面（客戶、供應商、商品、訂單）僅限已驗證使用者存取。未驗證使用者重新導向至首頁。

新增受保護路由時，在 `beforeLoad` 中加入驗證檢查：

```ts
beforeLoad: ({ context }) => {
  if (!context.auth.isAuthenticated) {
    throw redirect({ to: "/" });
  }
},
```

## 產品慣例

- 所有 UI 文案使用繁體中文，包含按鈕文字、標籤、錯誤訊息、提示文字。
- 新頁面以路由檔案形式加入 `src/routes/`；路由樹由 TanStack Router Vite 插件自動產生，不要手動編輯 `routeTree.gen.ts`。
- 後端資源（auth、data、storage）定義於 `amplify/`，使用 Amplify Gen2 的 `define*` 輔助函式。
- UI 元件使用 MUI，樣式使用 `sx` prop，不要使用 `styled()` 或外部 CSS 檔案。
- 根佈局（`__root.tsx`）包含 AppBar 導覽列與載入狀態處理，頁面內容透過 `<Outlet />` 渲染。
- Provider 堆疊順序（`main.tsx`）：`QueryClientProvider` → `ThemeProvider` + `CssBaseline` → `AuthProvider` → `RouterProvider`。
- 錯誤訊息從 `catch` 區塊中提取 `Error.message`，以使用者友善的繁體中文顯示於 MUI `Alert` 元件。
- 業務邏輯（狀態轉換、金額計算、庫存驗證）封裝於 `src/logic/` 下的純函式模組，方便測試。
- 實體間的關聯（客戶→訂單、供應商→採購、商品→明細）透過選取既有記錄建立，不手動輸入。
