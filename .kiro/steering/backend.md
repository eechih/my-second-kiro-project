---
inclusion: fileMatch
fileMatchPattern: 'amplify/**'
---

# 後端開發指引

當你修改 `amplify/` 下的檔案時，遵循以下模式。

## 架構定位

- `amplify/data/resource.ts`：集中定義 schema、model、custom mutation、authorization
- `amplify/functions/*`：訂單流程、自訂資料處理與圖片處理的 Lambda functions
- `amplify/storage/resource.ts`：S3 存取規則
- `amplify/backend.ts`：後端資源註冊、環境變數與 IAM / table grants

## Lambda handler 原則

- handler 型別優先使用 `Schema['mutationName']['functionHandler']`
- 若 handler 不需要 Amplify data client，就不要引入 `$amplify/env` 或 `getAmplifyDataClientConfig`
- 涉及多筆資料同步更新時，優先維持單一交易語意
- 回傳格式應延續既有 mutation 契約，避免前端還要額外分支處理
- 錯誤訊息與可預期失敗訊息使用繁體中文

## Schema 與 custom mutation

- 優先延續既有 model 命名、欄位語意、enum 與 queryField 命名
- 新增 custom mutation 時，要一併檢查：
  - `amplify/functions/<name>/handler.ts`
  - `amplify/functions/<name>/resource.ts`
  - `amplify/data/resource.ts`
  - `amplify/backend.ts`
- 涉及共用狀態列舉時，優先從 `@shared/models/*` 匯入，避免 schema 與應用邏輯漂移

## 訂單流程與共享邏輯

- 訂單狀態、明細狀態、出貨驗證、採購入庫、合併、分拆等規則優先重用 `@shared/logic/*`
- 不在 Lambda 內平行重寫另一套狀態機
- 涉及庫存、訂單與明細一起變更的流程，要特別檢查資料一致性與回補邏輯

## 權限與環境變數

- 新增 function 後，必須在 `amplify/backend.ts` 註冊
- 若 handler 直接讀寫 DynamoDB、S3 或其他 AWS 資源，需同步補上：
  - 環境變數
  - table / bucket grants
  - 額外 IAM policy
- 若使用 `$amplify/env/<name>`，名稱必須與對應 function 資源一致

## Storage 與圖片處理

- 商品照片與縮圖流程修改時，同步檢查 `amplify/storage/resource.ts` 與 `generate-thumbnail`
- 不要只改前端上傳流程，卻忽略 S3 access 與 Lambda 後處理

## 修改檢查清單

- 是否需要變更 schema 或 custom mutation？
- 是否需要在 `backend.ts` 註冊新資源？
- 是否需要更新 table grants、IAM 或環境變數？
- 是否有共享邏輯應抽到 `shared/logic/`？
- 是否會影響既有資料相容性或部署流程？
