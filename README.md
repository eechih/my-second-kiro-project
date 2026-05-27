# 電子商務訂單管理系統

基於 AWS Amplify Gen 2 的 React SPA 電子商務後台系統。系統以訂單履約為核心，整合客戶、供應商、商品、採購、入庫、出貨與庫存管理流程；所有使用者介面文字皆使用繁體中文。

## 系統概覽

- 前端：React 19、TypeScript、Vite、TanStack Router、TanStack Query、TanStack Table、TanStack Form、MUI
- 後端：AWS Amplify Gen 2、Cognito、AppSync、DynamoDB、S3、Lambda
- 共用邏輯：`shared/logic/` 與 `shared/models/` 供前端與 Lambda 共用

## 核心流程

```text
客戶下單 → 依訂單明細進貨採購 → 入庫確認（庫存增加）→ 出貨（庫存扣減）→ 訂單完成
```

## 核心功能

- 驗證：Email / 密碼註冊、登入、登出與個人資料
- 客戶管理：客戶資料 CRUD、搜尋
- 供應商管理：供應商資料 CRUD、搜尋
- 商品管理：商品 CRUD、搜尋、多張照片上傳、規格組合
- 訂單管理：訂單 CRUD、明細狀態追蹤、採購、入庫、出貨、合併、分拆
- 儀表板：待處理訂單、待入庫採購、待出貨明細摘要

## 快速開始

### 前置需求

- Node.js 18+
- npm
- AWS 帳號與 Amplify 開發權限

### 安裝依賴

```bash
npm install
```

### 啟動 Amplify sandbox

```bash
npm run sandbox
```

此步驟會建立 / 更新 `amplify_outputs.json`。

### 啟動前端開發伺服器

```bash
npm run dev
```

預設開在 `http://localhost:3000`。

## 常用指令

```bash
npm run build
npm run check
npm run lint
npm run test
npm run test:watch
npm run preview
```

## 專案結構

```text
.
├── shared/                    # 前端與 Lambda 共用模組
│   ├── models/                # 共用型別、常數、序列化
│   └── logic/                 # 業務邏輯純函式
├── amplify/                   # Amplify Gen 2 後端資源
│   ├── auth/
│   ├── data/
│   ├── functions/
│   ├── storage/
│   └── backend.ts
├── src/
│   ├── auth/                  # AuthProvider 與認證上下文
│   ├── components/            # 共用 UI 元件
│   ├── hooks/                 # 資料 hooks
│   ├── lib/                   # 前端工具與 client
│   ├── routes/                # TanStack Router 檔案式路由
│   ├── test/                  # Vitest 設定
│   ├── main.tsx
│   ├── routeTree.gen.ts       # 自動產生，不要手動編輯
│   └── theme.ts
├── .kiro/steering/            # 專案 steering 文件
├── amplify_outputs.json       # 自動產生，不要手動編輯
└── package.json
```

## 開發重點

- `src/auth/AuthProvider.tsx` 是唯一認證狀態來源
- 受保護頁面使用 TanStack Router `beforeLoad` 檢查登入狀態
- 伺服器狀態統一透過 TanStack Query 管理
- 業務邏輯優先放在 `shared/logic/`，避免在 UI 與 Lambda 各寫一份
- MUI 樣式使用 `sx` prop，不使用 `styled()` 或外部 CSS
- 不手動編輯 `src/routeTree.gen.ts` 與 `amplify_outputs.json`

## 文件導覽

- `.kiro/steering/product.md`：產品與業務概念
- `.kiro/steering/structure.md`：專案結構與檔案放置
- `.kiro/steering/tech.md`：技術棧與常用指令
- `.kiro/steering/frontend.md`：前端實作慣例
- `.kiro/steering/backend.md`：後端 / Amplify 實作慣例
- `.ai-rules.md`：AI agent 硬性約束與高風險檢查
- `agents.md`：AI agent 入口與工作方式

## AI 協作

本專案有多份 AI 協作文檔，各自角色如下：

| 檔案 | 角色 |
| --- | --- |
| `.ai-rules.md` | 硬性紅線與高風險檢查 |
| `agents.md` | Agent 入口、閱讀順序與工作方式 |
| `.kiro/steering/*.md` | 專案長期知識：產品、結構、技術、前端、後端 |

修改規則時，請同步維持這個分工：

- `.ai-rules.md` 管紅線
- `agents.md` 管導航
- `README.md` 管人類開發者快速理解與操作
