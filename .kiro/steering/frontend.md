---
inclusion: fileMatch
fileMatchPattern: 'src/**'
---

# 前端開發指引

當你修改 `src/` 下的檔案時，遵循以下模式。

## 架構定位

本專案以前端路由為主，而不是 `src/features/` 模組化目錄：

- `src/routes/`：頁面、路由切分、路由層資料流
- `src/routes/<module>/-components/`：模組私有元件
- `src/hooks/`：資料查詢、mutation 與 query key 管理
- `src/components/`：跨模組共用元件
- `src/lib/`：Amplify client、route guards、工具函式
- `shared/logic/`：前後端共用的業務邏輯

## 路由慣例

- 新頁面直接加到 `src/routes/`
- 受保護頁面使用 `beforeLoad` 檢查 `context.auth.isAuthenticated`
- 優先重用 `src/lib/route-guards.ts` 中既有 guard，而不是每頁重寫一遍
- 不手動編輯 `src/routeTree.gen.ts`

## 資料取得與 mutation

- AppSync client 優先透過 `src/lib/amplify-client.ts` 或既有封裝取得
- TanStack Query 查詢與 mutation 優先收斂到 `src/hooks/useCustomers.ts`、`useProducts.ts`、`useOrders.ts` 等檔案
- 不要把大量資料抓取、失效策略與錯誤轉換散落在頁面 component 中
- mutation 成功後應正確 invalidate 相關 query keys，避免畫面與資料不同步

## 型別與共享邏輯

- 型別優先從 `@shared/models` 或 Amplify schema 衍生
- 表單驗證、狀態轉換、金額計算、庫存檢查等規則優先使用 `@shared/logic/*`
- 若某段規則同時在前端與 Lambda 需要使用，應抽到 `shared/`，不要複製貼上

## UI 與互動

- 使用 MUI 元件與 `sx` prop
- 共用元件放 `src/components/`；只服務單一路由的元件放 `src/routes/<module>/-components/`
- 錯誤訊息使用繁體中文，並從 `Error.message` 提取內容
- 較重的頁面邏輯可拆成小型 helper 或 subcomponent，但不要過度抽象化

## 表單與表格

- 表單優先延續 TanStack Form 與現有驗證模式
- 列表頁通常由 route page 組裝 toolbar、table、dialog 等子元件
- TanStack Table 負責資料結構與欄位配置，UI 呈現延續現有 MUI Table 寫法

## 測試

- 純 UI 行為可放在 route 或 component 同層測試
- 純演算法或規則測試優先放在 `shared/logic/` 或 helper 同層
- 若頁面邏輯很重，優先測關鍵流程與狀態分支，而不是只測靜態渲染
