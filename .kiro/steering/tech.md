---
inclusion: always
---

# 技術棧

## 核心技術

| 類別 | 技術 | 說明 |
| --- | --- | --- |
| 執行環境 | React 19 + TypeScript | 啟用 `strict: true` |
| 建置工具 | Vite 6 | 搭配 TanStack Router Vite 插件 |
| 後端平台 | AWS Amplify Gen 2 | Cognito、AppSync、DynamoDB、S3、Lambda |
| 路由 | TanStack Router | 檔案式路由，自動產生 `routeTree.gen.ts` |
| 伺服器狀態 | TanStack Query | 查詢快取、失效與 mutation 管理 |
| 表格 | TanStack Table | 搭配 MUI Table 元件 |
| 表單 | TanStack Form | 表單狀態與驗證整合 |
| UI | MUI v6 + Emotion | 樣式以 `sx` prop 為主 |
| 測試 | Vitest + React Testing Library + fast-check | 單元測試與屬性測試 |

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | TypeScript 建置 + Vite 生產建置 |
| `npm run check` | 僅型別檢查 |
| `npm run lint` | ESLint 檢查 |
| `npm run preview` | 預覽建置結果 |
| `npm run test` | 單次執行 Vitest |
| `npm run test:watch` | 監聽模式測試 |
| `npm run sandbox` | 啟動 Amplify sandbox |

## 路徑別名

- `@/*` -> `./src/*`
- `@shared/*` -> `./shared/*`

## TypeScript 設定

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noUncheckedIndexedAccess: true`
- `noFallthroughCasesInSwitch: true`
- `moduleResolution: bundler`

## 程式碼風格

### 前端

- 使用 React 函式元件與 TypeScript
- 使用 MUI 元件與 `sx` prop，不使用外部 CSS 檔案或 `styled()`
- 路由守衛、Amplify client 與共用工具集中在 `src/lib/`

### 後端

- Amplify Gen 2 資源統一定義於 `amplify/`
- 自訂流程以 Lambda function 搭配 AppSync custom mutation 實作
- DynamoDB 交易與共享業務邏輯應明確分工，不混入 UI 假設

### 測試

- 測試與原始碼同層放置
- DOM 測試使用 `jsdom`
- 適合用規則驗證的邏輯優先補屬性測試

## 補充說明

- 前端工作方式請看 `frontend.md`
- 後端工作方式請看 `backend.md`
- 專案脈絡與目錄慣例請看 `product.md` 與 `structure.md`
