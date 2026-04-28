---
inclusion: always
---

# 專案結構

## 目前結構

```
.
├── shared/                    # 前端與 Lambda 共用的純函式模組（無 React 依賴）
│   ├── models/                # 資料模型型別定義與序列化
│   ├── logic/                 # 業務邏輯純函式（狀態轉換、金額計算、庫存驗證等）
│   └── tsconfig.json          # shared 模組的 TypeScript 設定
├── amplify/                   # Amplify Gen2 後端定義
│   ├── auth/
│   │   └── resource.ts        # 認證設定（Cognito）
│   ├── data/
│   │   └── resource.ts        # 資料模型定義（AppSync + DynamoDB）
│   ├── storage/
│   │   └── resource.ts        # 儲存設定（S3 商品照片）
│   └── backend.ts             # 後端進入點（註冊所有資源）
├── src/
│   ├── auth/
│   │   └── AuthProvider.tsx   # 認證 Context Provider（唯一的認證狀態來源）
│   ├── routes/                # 檔案式路由（TanStack Router）
│   │   ├── __root.tsx         # 根佈局（AppBar、導覽列、認證狀態注入）
│   │   ├── index.tsx          # 首頁 / 儀表板
│   │   ├── login.tsx          # Email/密碼登入與註冊
│   │   ├── profile.tsx        # 受保護 — 使用者個人資料
│   │   ├── customers/         # 客戶管理頁面
│   │   ├── suppliers/         # 供應商管理頁面
│   │   ├── products/          # 商品管理頁面
│   │   └── orders/            # 訂單管理頁面
│   ├── hooks/                 # 共用 React Hooks（TanStack Query）
│   ├── components/            # 共用 UI 元件（MUI）
│   ├── lib/                   # 工具函式（Amplify client 等）
│   ├── test/
│   │   └── setup.ts           # Vitest 全域測試設定
│   ├── main.tsx               # 應用程式進入點（Amplify 設定、Provider 堆疊、Router）
│   ├── routeTree.gen.ts       # 自動產生 — 不要編輯
│   ├── theme.ts               # MUI 主題設定
│   └── vite-env.d.ts          # Vite 客戶端型別宣告
├── amplify_outputs.json       # 自動產生 — 由 Amplify sandbox/deploy 產生
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 檔案放置規則

| 新增內容        | 放置位置          | 說明                                                                                                        |
| --------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| 新頁面 / 路由   | `src/routes/`     | 檔名即 URL 路徑。路由樹自動重新產生。子目錄用於模組分組（如 `customers/`、`orders/`）。                     |
| 可重用 UI 元件  | `src/components/` | 每個元件一個檔案。使用 MUI + `sx` prop 設定樣式。                                                           |
| 自訂 React Hook | `src/hooks/`      | 以 `use` 為前綴。每個 hook 專注於單一關注點。每個實體模組一個檔案（如 `useCustomers.ts`、`useOrders.ts`）。 |
| 純業務邏輯      | `shared/logic/`   | 不引入 React。前端與 Lambda 共用。狀態轉換、金額計算、庫存驗證、合併/分拆邏輯皆放此處。                     |
| 資料模型型別    | `shared/models/`  | TypeScript 介面與型別定義。前端與 Lambda 共用。每個實體一個檔案，`index.ts` 統一匯出。                      |
| 工具函式        | `src/lib/`        | Amplify client 封裝等非 React 工具。                                                                        |
| 後端資源        | `amplify/<資源>/` | 每種資源類型（auth、data、storage）各自一個子目錄。新增後須在 `backend.ts` 中註冊。                         |
| 測試檔案        | 與原始碼同層      | 命名為 `<source>.test.tsx` 或 `<source>.test.ts`。屬性測試命名為 `<source>.property.test.ts`。              |
| 測試工具 / 設定 | `src/test/`       | 共用 mock、fixture 及 Vitest 設定。                                                                         |

## 路由目錄慣例

每個管理模組在 `src/routes/` 下有獨立子目錄，遵循統一的檔案命名：

```
src/routes/<module>/
├── index.tsx          # 列表頁面（分頁 + 搜尋）
├── new.tsx            # 新增表單頁面
└── $<entityId>.tsx    # 詳情 / 編輯頁面（動態路由參數）
```

## 自動產生的檔案 — 不要編輯

- `src/routeTree.gen.ts` — 路由檔案變更時由 TanStack Router Vite 插件重新產生。
- `amplify_outputs.json` — 由 `ampx sandbox` 或 Amplify 部署重新產生。
