---
inclusion: always
---

# 技術棧

## 核心技術

| 類別     | 技術                                        | 說明                                                        |
| -------- | ------------------------------------------- | ----------------------------------------------------------- |
| 執行環境 | React 19 + TypeScript                       | 嚴格模式（`strict: true`）                                  |
| 建置工具 | Vite 6                                      | 含 TanStack Router Vite 插件（自動產生路由樹）              |
| 後端     | AWS Amplify Gen2                            | Cognito（認證）、AppSync + DynamoDB（資料）、S3（檔案儲存） |
| 路由     | TanStack Router                             | 檔案式路由，Vite 插件自動產生 `routeTree.gen.ts`            |
| 資料擷取 | TanStack Query                              | 伺服器狀態快取與同步，不額外引入全域狀態管理庫              |
| 表格     | TanStack Table                              | 搭配 MUI Table 元件渲染，提供排序、分頁功能                 |
| 表單     | TanStack Form                               | 搭配 `src/logic/` 中的純函式驗證邏輯                        |
| UI       | MUI (Material UI) v6 + Emotion              | 樣式使用 `sx` prop，不使用 `styled()` 或外部 CSS            |
| 測試     | Vitest + React Testing Library + fast-check | 單元測試 + 屬性測試（PBT）                                  |

## 建置與開發指令

| 指令                 | 說明                                   |
| -------------------- | -------------------------------------- |
| `npm run dev`        | 啟動 Vite 開發伺服器（localhost:5173） |
| `npm run build`      | TypeScript 型別檢查 + Vite 正式建置    |
| `npm run preview`    | 預覽正式建置結果                       |
| `npm run lint`       | ESLint 檢查                            |
| `npm run test`       | 執行所有測試（Vitest，單次執行）       |
| `npm run test:watch` | 監聽模式執行測試                       |
| `npx ampx sandbox`   | 啟動 Amplify 雲端沙箱（部署後端）      |

## 路徑別名

專案設定了 `@` 路徑別名指向 `./src`，在 `vite.config.ts` 和 `tsconfig.json` 中皆有設定：

```ts
import { something } from "@/models/order";
```

## TypeScript 設定

- `strict: true` — 啟用所有嚴格型別檢查
- `noUnusedLocals: true` — 不允許未使用的區域變數
- `noUnusedParameters: true` — 不允許未使用的參數
- `noUncheckedIndexedAccess: true` — 索引存取回傳 `T | undefined`
- `noFallthroughCasesInSwitch: true` — switch 不允許 fallthrough

## 開發慣例

### 路由

- 檔案式路由：在 `src/routes/` 下新增檔案即建立路由
- 路由樹（`routeTree.gen.ts`）由 TanStack Router Vite 插件自動產生，不要手動編輯
- 認證 context 透過 `Route.useRouteContext()` 取得
- 受保護路由使用 `beforeLoad` + `throw redirect` 模式

### 後端資源

- 後端資源定義於 `amplify/` 目錄，使用 Amplify Gen2 的 `define*` 輔助函式
- 每種資源類型（auth、data、storage）各自一個子目錄
- 新增資源後須在 `amplify/backend.ts` 中註冊
- Amplify 密鑰（OAuth 憑證等）透過 `secret()` 輔助函式管理，不要寫死在程式碼中

### UI 元件

- 使用 MUI 元件庫，樣式使用 `sx` prop
- 不使用 `styled()` 或外部 CSS 檔案
- 圖示使用 `@mui/icons-material`

### 狀態管理

- 伺服器狀態使用 TanStack Query（`useQuery` / `useMutation`）
- 不引入 Redux、Zustand 或其他全域狀態管理庫
- 業務邏輯（狀態轉換、金額計算、庫存驗證）封裝於 `src/logic/` 下的純函式模組，不含 React 依賴

### 測試

- 測試框架：Vitest（`jsdom` 環境）+ React Testing Library
- 屬性測試：fast-check，每個屬性至少 100 次迭代
- 測試設定檔：`src/test/setup.ts`
- 測試檔案與原始碼同層，命名為 `<source>.test.ts(x)` 或 `<source>.property.test.ts`
- 執行測試：`npm run test`（單次）或 `npm run test:watch`（監聽模式）
