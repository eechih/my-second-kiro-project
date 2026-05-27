# AGENTS.md

## 角色定位

本檔是 AI agent 進入此專案時的導航文件。

- `.ai-rules.md`：硬性紅線與高風險檢查
- `agents.md`：專案脈絡、閱讀順序與工作方式
- `.kiro/steering/*.md`：產品、結構、技術與前後端細節

若與 `.ai-rules.md` 衝突，以 `.ai-rules.md` 為準。

## 建議閱讀順序

1. `.ai-rules.md`
2. 本檔 `agents.md`
3. `.kiro/steering/product.md`
4. `.kiro/steering/structure.md`
5. `.kiro/steering/tech.md`
6. 依任務補讀：
   - 前端：`.kiro/steering/frontend.md`
   - 後端：`.kiro/steering/backend.md`

## 專案定位

- 本專案是基於 AWS Amplify Gen 2 的 React SPA 電子商務訂單管理系統
- UI 文案一律使用繁體中文
- 核心流程：客戶下單 -> 進貨採購 -> 入庫確認 -> 出貨扣減庫存 -> 訂單完成
- 主要模組：客戶管理、供應商管理、商品管理、訂單管理、儀表板、驗證

## 先找哪裡

依任務類型，優先閱讀：

- 路由與頁面：`src/routes/`
- 認證：`src/auth/AuthProvider.tsx`
- 路由守衛：`src/lib/route-guards.ts`
- 共用資料抓取：`src/hooks/`
- 共用元件：`src/components/`
- 共享業務邏輯：`shared/logic/`
- 共享模型與常數：`shared/models/`
- Amplify schema 與授權：`amplify/data/resource.ts`
- 後端資源註冊：`amplify/backend.ts`
- 檔案儲存：`amplify/storage/resource.ts`
- 訂單流程 Lambda：`amplify/functions/*/handler.ts`

## 工作方式

- 優先延續既有結構與命名，不額外建立新的資料夾慣例
- 新增功能時，先判斷應放在 route、component、hook、lib 還是 shared logic
- 與 UI 無關且可重用的規則，優先抽到 `shared/logic/`
- 修改 UI 時，不只看畫面，也要同步確認資料來源、授權與狀態流
- 涉及 schema、庫存、訂單狀態、IAM 或 Lambda 交易流程時，回頭檢查 `.ai-rules.md`

## 檔案放置速查

- 路由頁面：`src/routes/`
- 路由私有元件：`src/routes/<module>/-components/`
- 共用 UI 元件：`src/components/`
- 資料 hooks：`src/hooks/`
- 前端工具：`src/lib/`
- 純業務邏輯：`shared/logic/`
- 共用資料模型：`shared/models/`
- 後端資源：`amplify/`
- 測試：與原始碼同層，命名為 `<source>.test.ts(x)` 或 `<source>.property.test.ts`

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | TypeScript + Vite 生產建置 |
| `npm run check` | 型別檢查 |
| `npm run lint` | ESLint 檢查 |
| `npm run test` | 單次執行測試 |
| `npm run test:watch` | 監聽模式測試 |
| `npm run sandbox` | 啟動 Amplify sandbox |

## 交付時要說明

- 改了什麼
- 有沒有驗證
- 是否有殘留風險
- 若屬高風險任務，是否已回答 `.ai-rules.md` 的收尾檢查項目
