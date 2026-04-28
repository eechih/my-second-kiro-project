# 電子商務訂單管理系統

基於 AWS Amplify Gen2 的 React SPA，提供訂單、進貨採購、出貨、庫存管理功能。以訂單為核心，整合進貨採購與出貨流程。

## 核心功能

- **客戶管理** — 客戶基本資料 CRUD、搜尋，訂單建立時從客戶清單選取
- **供應商管理** — 供應商基本資料 CRUD、搜尋，進貨採購時從供應商清單選取
- **商品管理** — 商品 CRUD、多張照片上傳（S3，含前端壓縮與自動縮圖）、多維度規格組合（如顏色×尺寸）
- **訂單管理** — 訂單 CRUD、明細項目狀態追蹤、進貨採購/入庫、出貨/庫存扣減
- **訂單合併/分拆** — 同一客戶的未出貨訂單可合併或分拆（數量守恆）
- **儀表板** — 待處理訂單、待入庫採購、待出貨明細的摘要數量

## 業務流程

```
客戶下單 → 依明細進貨採購 → 入庫確認（庫存增加）→ 出貨（庫存扣減）→ 訂單完成
```

### 訂單狀態

`pending` → `confirmed` → `shipping` → `completed`（或任何狀態 → `cancelled`）

任一明細出貨後自動變為 `shipping`，全部出貨後自動變為 `completed`。

### 明細項目狀態

`待處理` → `已訂購` → `已收到` → `已出貨`（或 `待處理`/`已訂購` → `缺貨`）

每個狀態轉換記錄日期時間（訂購、收到、出貨）。

### 商品規格組合

商品可定義多組規格維度（如顏色、尺寸），系統自動產生笛卡爾積組合（如「黑 L」、「白 XL」）。每個組合有獨立 SKU、庫存、可選的單價/成本覆寫。庫存追蹤在規格組合層級操作。

## 架構特色

- **事務性操作**：出貨、入庫、合併、分拆等涉及多表更新的操作，使用 Lambda Custom Mutations + DynamoDB `TransactWriteItems` 確保原子性
- **樂觀併發控制**：Product/ProductVariant 使用 `version` 欄位 + `ConditionExpression`，防止併發庫存衝突
- **前後端共用狀態驗證**：`src/logic/` 下的狀態轉換純函式同時供前端與 Lambda 使用，確保一致性
- **樂觀更新**：狀態變更操作使用 TanStack Query 的 `onMutate` 立即更新 UI，失敗時自動回滾
- **自動預取**：訂單列表 hover 時預取詳情資料，提升頁面切換流暢感
- **圖片優化**：上傳前 Canvas 壓縮、Lambda + sharp 自動產生縮圖、S3 物件標籤

## 技術棧

| 類別     | 技術                                                                |
| -------- | ------------------------------------------------------------------- |
| 前端     | React 19 + TypeScript（strict mode）                                |
| 建置     | Vite 6                                                              |
| 後端     | AWS Amplify Gen2（Cognito + AppSync + DynamoDB + S3 + Lambda）      |
| 路由     | TanStack Router（檔案式路由）                                       |
| 資料擷取 | TanStack Query（含樂觀更新、預取、快取失效）                        |
| 表格     | TanStack Table                                                      |
| 表單     | TanStack Form（含 onBlurAsync 非同步驗證、form.subscribe 欄位依賴） |
| UI       | MUI v6 + Emotion（`sx` prop）                                       |
| 測試     | Vitest + React Testing Library + fast-check（屬性測試）             |

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
npm run test        # 單次執行
npm run test:watch  # 監聽模式
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
│   ├── functions/             # Lambda Custom Mutations
│   │   ├── ship-line-item/    # 出貨（庫存扣減 + 狀態更新）
│   │   ├── confirm-received/  # 入庫確認（庫存增加 + 狀態更新）
│   │   ├── merge-orders/      # 訂單合併
│   │   ├── split-order/       # 訂單分拆
│   │   └── generate-thumbnail/# 縮圖產生（S3 觸發）
│   ├── storage/resource.ts    # 檔案儲存（S3）
│   └── backend.ts             # 後端進入點
├── src/
│   ├── routes/                # 檔案式路由（頁面）
│   │   ├── customers/         # 客戶管理
│   │   ├── suppliers/         # 供應商管理
│   │   ├── products/          # 商品管理
│   │   └── orders/            # 訂單管理
│   ├── models/                # TypeScript 型別定義
│   ├── logic/                 # 業務邏輯純函式（前端 + Lambda 共用）
│   ├── hooks/                 # React Hooks（TanStack Query）
│   ├── components/            # 共用 UI 元件
│   ├── lib/                   # 工具函式（Amplify client）
│   ├── auth/                  # 認證 Context
│   └── main.tsx               # 應用程式進入點
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 規格文件

詳細的需求、設計與實作任務文件位於 `.kiro/specs/ecommerce-order-management/`：

- `requirements.md` — 需求文件（10 個需求，含驗收條件）
- `design.md` — 設計文件（架構、資料模型、元件介面、正確性屬性、測試策略）
- `tasks.md` — 實作任務清單（17 個頂層任務）
