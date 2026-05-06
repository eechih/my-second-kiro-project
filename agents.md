# Codex Agent Guide

## 目的

此文件為專案內部的 Codex Agent 指南，匯整 `.kiro/steering` 中的產品、結構與技術規範。AI 助手應依據此指南進行修改與開發，並保持與專案現有風格一致。

## 專案概述

- 本專案為基於 AWS Amplify Gen2 的 React SPA 電子商務訂單管理系統。UI 文字皆為繁體中文。
- 核心流程：客戶下單 → 進貨採購 → 入庫確認 → 出貨扣減庫存 → 訂單完成。
- 主要模組：客戶管理、供應商管理、商品管理、訂單管理、儀表板與驗證。

## 核心業務概念

- 商品管理支援 CRUD、搜尋、多張照片上傳（S3）、多維度規格組合。
- 訂單與明細狀態自動同步；出貨後明細、訂單狀態會依規則更新。
- 庫存追蹤以商品規格組合為主，無規格組合時以商品本身管理庫存。
- 同一客戶的未出貨訂單可合併或分拆，並保持數量守恆。

## 專案結構

- `shared/`
  - `models/`：共用資料模型型別與序列化。
  - `logic/`：純業務函式，無 React 依賴，供前端與 Lambda 共用。
- `amplify/`
  - `auth/`：Cognito 認證設定。
  - `data/`：AppSync + DynamoDB 資料模型。
  - `storage/`：S3 儲存設定。
  - `backend.ts`：註冊所有後端資源。
- `src/`
  - `auth/`：`AuthProvider` 與認證上下文。
  - `routes/`：檔案式路由頁面。
  - `hooks/`：自訂 React Hooks（主要與 TanStack Query 整合）。
  - `components/`：共用 UI 元件。
  - `lib/`：Amplify client、工具函式、CSV 產生器等。
  - `test/`：Vitest 全域測試設定。
- 根目錄：`package.json`、`tsconfig.json`、`vite.config.ts`、`amplify_outputs.json`。

## 路由規則

- 管理模組置於 `src/routes/<module>/`。
  - `index.tsx`：列表頁。
  - `new.tsx`：新增頁。
  - `$<entityId>.tsx`：詳細或編輯頁。
- 路由樹由 TanStack Router Vite 外掛自動產生，`src/routeTree.gen.ts` 不可手動編輯。
- 受保護路由須在 `beforeLoad` 中檢查 `context.auth.isAuthenticated`，未驗證則導向 `/`。

## 欄位與檔案規則

- 新頁面 / 路由：`src/routes/`。
- 可重用 UI 元件：`src/components/`。
- 自訂 Hook：`src/hooks/`。
- 純業務邏輯：`shared/logic/`。
- 資料模型型別：`shared/models/`。
- 測試檔案：與原始碼同層，命名為 `<source>.test.ts(x)` 或 `<source>.property.test.ts`。

## 技術棧

- React 19 + TypeScript（`strict: true`）
- Vite 6
- AWS Amplify Gen2：Cognito、AppSync + DynamoDB、S3
- TanStack Router
- TanStack Query
- TanStack Table
- TanStack Form
- MUI v6 + Emotion
- Vitest + React Testing Library + fast-check

## 開發慣例

- UI 文案皆使用繁體中文。
- MUI 樣式使用 `sx` prop，不使用 `styled()` 或外部 CSS 檔案。
- 路徑別名：`@` 指向 `./src`。
- 不引入 Redux、Zustand 或其他全域狀態管理庫。
- 伺服器狀態使用 TanStack Query，透過 `useQuery` / `useMutation`。
- 業務邏輯放在 `shared/logic/`，避免 React 依賴。
- 錯誤處理從 `catch` 區塊提取 `Error.message`，並以中文顯示在 MUI `Alert`。
- `AuthProvider` 為唯一認證上下文來源。
- 專案中若新增後端資源，須在 `amplify/backend.ts` 註冊。

## Agent 開發指南

### 一致性優先

- 依照既有專案結構新增檔案，避免額外建立無必要的目錄。
- 路由頁面放 `src/routes/`，元件放 `src/components/`，Hook 放 `src/hooks/`。
- 若新增純業務邏輯，放 `shared/logic/`，並補上對應測試。

### UI 與文案

- 介面文字皆為繁體中文。
- 使用 MUI 元件與 `sx` prop 佈局。
- 按鈕、提示、錯誤訊息的文案應與專案現有風格一致。

### 認證與存取

- 受保護頁面必須在 `beforeLoad` 進行 `context.auth.isAuthenticated` 檢查。
- 未驗證使用者需重新導向 `/`。

### 自動產生檔案

- 不要手動編輯 `src/routeTree.gen.ts`。
- 不要手動編輯 `amplify_outputs.json`。

### 測試要求

- 新功能建議新增對應測試。
- 純業務邏輯應新增 `shared/logic/` 測試。

## 重要提醒

- `AuthProvider` 是唯一認證狀態來源，請勿引入其他 auth context。
- 新增路由時務必保留現有檔案式路由習慣。
- `src/routeTree.gen.ts` 與 `amplify_outputs.json` 均為自動產生，禁止手動修改。

---

此檔案為 Codex Agent 專用說明，請依據現有規範與工程慣例進行修改與開發。
