# 電子商務訂單管理系統

基於 AWS Amplify Gen2 的 React SPA，提供訂單、進貨採購、出貨、庫存管理功能。

## 核心功能

- **客戶管理** — 客戶基本資料 CRUD、搜尋
- **供應商管理** — 供應商基本資料 CRUD、搜尋
- **商品管理** — 商品 CRUD、多張照片上傳（S3）、多維度規格組合（如顏色×尺寸）
- **訂單管理** — 訂單 CRUD、明細項目狀態追蹤、進貨採購/入庫、出貨/庫存扣減
- **訂單合併/分拆** — 同一客戶的未出貨訂單可合併或分拆
- **儀表板** — 待處理訂單、待入庫採購、待出貨明細的摘要

## 業務流程

```
客戶下單 → 依明細進貨採購 → 入庫確認（庫存增加）→ 出貨（庫存扣減）→ 訂單完成
```

### 訂單狀態

`pending` → `confirmed` → `shipping` → `completed`（或任何狀態 → `cancelled`）

### 明細項目狀態

`待處理` → `已訂購` → `已收到` → `已出貨`（或 `待處理`/`已訂購` → `缺貨`）

## 技術棧

| 類別     | 技術                                                  |
| -------- | ----------------------------------------------------- |
| 前端     | React 19 + TypeScript                                 |
| 建置     | Vite 6                                                |
| 後端     | AWS Amplify Gen2（Cognito + AppSync + DynamoDB + S3） |
| 路由     | TanStack Router（檔案式路由）                         |
| 資料擷取 | TanStack Query                                        |
| 表格     | TanStack Table                                        |
| 表單     | TanStack Form                                         |
| UI       | MUI v6 + Emotion                                      |
| 測試     | Vitest + React Testing Library + fast-check           |

## 快速開始

### 前置需求

- Node.js 18+
- npm
- AWS 帳號（用於 Amplify 後端）

### 安裝

```bash
npm install
```

### 開發

```bash
# 啟動 Amplify 雲端沙箱（部署後端）
npx ampx sandbox

# 啟動開發伺服器
npm run dev
```

開發伺服器啟動後，開啟 http://localhost:5173

### 建置

```bash
npm run build
```

### 測試

```bash
# 單次執行
npm run test

# 監聽模式
npm run test:watch
```

### 其他指令

```bash
npm run lint       # ESLint 檢查
npm run preview    # 預覽正式建置
```

## 專案結構

```
.
├── amplify/                   # Amplify Gen2 後端定義
│   ├── auth/resource.ts       # 認證設定（Cognito）
│   ├── data/resource.ts       # 資料模型（AppSync + DynamoDB）
│   ├── storage/resource.ts    # 檔案儲存（S3）
│   └── backend.ts             # 後端進入點
├── src/
│   ├── routes/                # 檔案式路由（頁面）
│   ├── models/                # TypeScript 型別定義
│   ├── logic/                 # 業務邏輯純函式
│   ├── hooks/                 # React Hooks（TanStack Query）
│   ├── components/            # 共用 UI 元件
│   ├── auth/                  # 認證 Context
│   └── main.tsx               # 應用程式進入點
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 規格文件

詳細的需求、設計與實作任務文件位於：

- `.kiro/specs/ecommerce-order-management/requirements.md` — 需求文件
- `.kiro/specs/ecommerce-order-management/design.md` — 設計文件
- `.kiro/specs/ecommerce-order-management/tasks.md` — 實作任務清單
