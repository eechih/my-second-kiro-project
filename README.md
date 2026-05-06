# 電子商務訂單管理系統

基於 **AWS Amplify Gen2** 的 React SPA 電子商務後台系統。系統以訂單為核心，整合客戶下單、進貨採購、入庫確認、出貨扣減庫存與訂單完成流程；所有使用者介面文字皆使用繁體中文。

後端使用 Cognito、AppSync + DynamoDB、S3 與 Lambda；前端使用 TanStack Router、TanStack Query、TanStack Table、TanStack Form 與 MUI 建構管理介面。

## 核心功能

- **驗證**
  - Email/密碼註冊、驗證碼確認、登入與登出
  - Cognito 認證狀態由 `AuthProvider` 集中管理

- **客戶管理**
  - 客戶基本資料 CRUD、搜尋
  - 建立訂單時從既有客戶清單選取

- **供應商管理**
  - 供應商基本資料 CRUD、搜尋
  - 建立進貨採購時從既有供應商清單選取

- **商品管理**
  - 商品基本資料 CRUD、搜尋
  - 多張照片上傳至 S3
  - 多維度規格組合，例如顏色 x 尺寸
  - 每個規格組合可有獨立 SKU、庫存與可選的單價/成本覆寫

- **訂單管理**
  - 訂單 CRUD
  - 明細項目狀態追蹤
  - 進貨採購、入庫確認、出貨與庫存扣減流程整合
  - 同一客戶的未出貨訂單可合併或分拆，並保持數量守恆

- **儀表板**
  - 待處理訂單數
  - 待入庫採購數
  - 待出貨明細數

## 業務流程

```text
客戶下單 → 依訂單明細進貨採購 → 入庫確認（庫存增加）→ 出貨（庫存扣減）→ 訂單完成
```

## 業務領域概念

### 訂單狀態

```text
pending → confirmed → shipping → completed
```

訂單可從任何狀態轉為 `cancelled`。任一明細出貨後，訂單自動變為 `shipping`；全部明細出貨後，訂單自動變為 `completed`。

### 明細項目狀態

```text
待處理 → 已訂購 → 已收到 → 已出貨
```

`待處理` 或 `已訂購` 的明細可轉為 `缺貨`。狀態轉換會記錄訂購、收到與出貨日期時間，並驅動訂單層級狀態同步。

### 商品規格組合

商品可定義多組規格維度，例如顏色、尺寸。系統依規格維度產生笛卡爾積組合，例如「黑 L」、「白 XL」。庫存預設在規格組合層級操作；無規格組合的商品則在商品層級追蹤庫存。

## 架構特色

- **Amplify Gen2 後端**：`amplify/` 定義 Cognito、AppSync + DynamoDB、S3 與 Lambda 資源。
- **集中式認證**：`src/auth/AuthProvider.tsx` 是唯一認證狀態來源，路由透過 context 取得驗證狀態。
- **檔案式路由**：管理頁面放在 `src/routes/`，路由樹由 TanStack Router Vite 外掛自動產生。
- **伺服器狀態管理**：資料擷取、快取、突變與快取失效透過 TanStack Query 處理。
- **共用業務邏輯**：狀態轉換、金額計算、庫存驗證、合併與分拆邏輯放在 `shared/logic/`，避免 React 依賴，供前端與 Lambda 共用。
- **共用資料模型**：前後端共用型別與序列化邏輯放在 `shared/models/`。
- **MUI 介面**：共用 UI 元件使用 MUI，樣式以 `sx` prop 撰寫。

## 技術棧

| 類別 | 技術 |
| --- | --- |
| 前端 | React 19 + TypeScript（strict mode） |
| 建置 | Vite 6 |
| 後端 | AWS Amplify Gen2（Cognito + AppSync + DynamoDB + S3 + Lambda） |
| 路由 | TanStack Router（檔案式路由） |
| 資料擷取 | TanStack Query |
| 表格 | TanStack Table |
| 表單 | TanStack Form |
| UI | MUI v6 + Emotion（`sx` prop） |
| 測試 | Vitest + React Testing Library + fast-check |

## 快速開始

### 前置需求

- Node.js 18+
- npm
- AWS 帳號與 Amplify 開發權限

### 安裝依賴

```bash
npm install
```

### 啟動後端沙箱

```bash
npm run sandbox
```

此指令會啟動 Amplify 雲端沙箱並產生 `amplify_outputs.json`。

### 啟動前端開發伺服器

```bash
npm run dev
```

開發伺服器預設位於 `http://localhost:5173`。

### 建置

```bash
npm run build
```

### 測試

```bash
npm run test
npm run test:watch
```

### 其他指令

```bash
npm run lint
npm run preview
```

## 專案結構

```text
.
├── shared/                    # 前端與 Lambda 共用模組，無 React 依賴
│   ├── models/                # 資料模型型別與序列化
│   ├── logic/                 # 業務邏輯純函式
│   └── tsconfig.json          # shared 模組 TypeScript 設定
├── amplify/                   # Amplify Gen2 後端定義
│   ├── auth/                  # Cognito 認證設定
│   ├── data/                  # AppSync + DynamoDB 資料模型
│   ├── functions/             # Lambda Custom Mutations 與 S3 觸發函式
│   ├── storage/               # S3 商品照片儲存設定
│   └── backend.ts             # 後端資源註冊入口
├── src/
│   ├── auth/                  # AuthProvider 與認證上下文
│   ├── routes/                # TanStack Router 檔案式路由
│   ├── hooks/                 # TanStack Query 整合 hooks
│   ├── components/            # MUI 共用 UI 元件
│   ├── lib/                   # Amplify client 與工具函式
│   ├── test/                  # Vitest 全域測試設定
│   ├── main.tsx               # 應用程式進入點
│   ├── routeTree.gen.ts       # 自動產生，不要手動編輯
│   └── theme.ts               # MUI 主題設定
├── amplify_outputs.json       # 自動產生，不要手動編輯
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 開發規範

### 路由

管理模組放在 `src/routes/<module>/`，並遵循檔案式路由命名：

```text
src/routes/<module>/
├── index.tsx          # 列表頁
├── new.tsx            # 新增頁
└── $<entityId>.tsx    # 詳情或編輯頁
```

受保護路由需在 `beforeLoad` 檢查驗證狀態，未驗證使用者導向首頁：

```ts
beforeLoad: ({ context }) => {
  if (!context.auth.isAuthenticated) {
    throw redirect({ to: "/" });
  }
},
```

### 檔案放置

| 新增內容 | 放置位置 |
| --- | --- |
| 新頁面 / 路由 | `src/routes/` |
| 可重用 UI 元件 | `src/components/` |
| 自訂 React Hook | `src/hooks/` |
| 純業務邏輯 | `shared/logic/` |
| 資料模型型別 | `shared/models/` |
| 工具函式 | `src/lib/` |
| 後端資源 | `amplify/<resource>/`，並在 `amplify/backend.ts` 註冊 |
| 測試檔案 | 與原始碼同層，命名為 `<source>.test.ts(x)` 或 `<source>.property.test.ts` |

### 程式慣例

- UI 文案、錯誤訊息、按鈕與提示皆使用繁體中文。
- 使用 MUI 元件與 `sx` prop；不使用 `styled()` 或外部 CSS 檔案。
- 使用 `@` 路徑別名匯入 `src/` 下的模組。
- 伺服器狀態使用 TanStack Query；不引入 Redux、Zustand 或其他全域狀態管理庫。
- 錯誤處理從 `catch` 區塊提取 `Error.message`，並以繁體中文顯示在 MUI `Alert`。
- 新增後端資源時，務必在 `amplify/backend.ts` 註冊。
- 不要手動編輯 `src/routeTree.gen.ts` 或 `amplify_outputs.json`。

## 規格與 Steering 文件

- `.kiro/steering/product.md`：產品定位、核心功能與業務概念
- `.kiro/steering/structure.md`：專案結構與檔案放置規則
- `.kiro/steering/tech.md`：技術棧、指令與開發慣例
- `.kiro/specs/ecommerce-order-management/`：需求、設計與任務文件
