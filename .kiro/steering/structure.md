---
inclusion: always
---

# 專案結構

## 目前結構

```
.
├── shared/                    # 前端與 Lambda 共用的純函式模組
│   ├── logic/                 # 業務邏輯：狀態轉換、驗證、計算、合併/分拆
│   ├── models/                # 共用型別、常數、序列化
│   └── tsconfig.json
├── amplify/                   # Amplify Gen 2 後端資源
│   ├── auth/                  # Cognito 設定
│   ├── data/                  # AppSync + DynamoDB schema / authorization
│   ├── functions/             # 自訂 Lambda functions
│   ├── storage/               # S3 設定
│   └── backend.ts             # 註冊所有後端資源
├── src/
│   ├── auth/                  # AuthProvider 與認證上下文
│   ├── components/            # 共用 UI 元件
│   ├── hooks/                 # TanStack Query 與功能型 hooks
│   ├── lib/                   # Amplify client、route guard、工具函式
│   ├── routes/                # TanStack Router 檔案式路由
│   ├── test/                  # Vitest 全域設定
│   ├── main.tsx               # 應用程式入口
│   ├── routeTree.gen.ts       # 自動產生，不可手動編輯
│   └── theme.ts               # MUI 主題
├── amplify_outputs.json       # 自動產生，不可手動編輯
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 檔案放置規則

| 新增內容 | 放置位置 | 說明 |
| --- | --- | --- |
| 路由頁面 | `src/routes/` | 以檔名對應 URL，管理模組使用子目錄分組 |
| 路由私有元件 | `src/routes/<module>/-components/` | 只服務單一路由或單一模組的呈現元件 |
| 共用 UI 元件 | `src/components/` | 可跨模組重用的元件 |
| 資料 hooks | `src/hooks/` | TanStack Query hooks、mutation hooks、查詢 key |
| 前端工具 | `src/lib/` | 非 React 工具，例如 client、guard、CSV、table helpers |
| 純業務邏輯 | `shared/logic/` | 不依賴 React，可供前端與 Lambda 共用 |
| 共用資料模型 | `shared/models/` | 型別、常數與資料模型工具 |
| 後端 schema / auth / storage | `amplify/` | Amplify Gen 2 資源定義 |
| 測試 | 與原始碼同層 | 命名為 `<source>.test.ts(x)` 或 `<source>.property.test.ts` |

## 路由慣例

管理模組通常使用以下檔案命名：

```
src/routes/<module>/
├── index.tsx
├── new.tsx
└── $<entityId>.tsx
```

若某頁面拆出大量專用元件，使用 `-components/` 收納，避免汙染全域共用元件區。

## 模組閱讀順序

當你要理解某個功能時，建議依序閱讀：

1. `src/routes/<module>/...`
2. `src/hooks/use<Domain>.ts`
3. `shared/logic/*`
4. `shared/models/*`
5. `amplify/data/resource.ts`
6. 對應 `amplify/functions/*`

## 自動產生檔案

- `src/routeTree.gen.ts` 由 TanStack Router Vite 插件產生，不要手動編輯
- `amplify_outputs.json` 由 Amplify sandbox 或部署流程產生，不要手動編輯
