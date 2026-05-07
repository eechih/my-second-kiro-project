# 實作計畫：AWS 資源連結頁面

## 概述

將設計文件中的 AWS 資源連結頁面拆解為漸進式的編碼任務。每個任務建立在前一個任務的基礎上，最終整合為完整的受保護路由頁面。實作語言為 TypeScript，UI 框架為 React + MUI。

## 任務

- [x] 1. 建立 AWS Console URL 建構工具模組
  - [x] 1.1 建立 `src/lib/aws-console-urls.ts`，實作所有 URL 建構函式
    - 實作 `buildCognitoUserPoolUrl(region, userPoolId)` 函式
    - 實作 `buildCognitoIdentityPoolUrl(region, identityPoolId)` 函式
    - 實作 `buildS3BucketUrl(bucketName)` 函式
    - 實作 `buildAppSyncUrl(region)` 函式
    - 實作 `buildDynamoDBTableUrl(region, tableName)` 函式
    - 每個函式須有明確的回傳型別標註
    - 使用 named export
    - _需求：2.5, 2.6, 3.4, 4.4, 5.3, 7.4_

  - [ ]\* 1.2 建立 `src/lib/__tests__/aws-console-urls.test.ts` 單元測試
    - 測試各函式以已知輸入產生正確的 URL 格式
    - 驗證 URL 中包含正確的 region 與 resource ID
    - 測試邊界情況：含特殊字元的 resource ID
    - _需求：2.5, 2.6, 3.4, 4.4, 5.3_

- [x] 2. 建立 Infrastructure 路由頁面
  - [x] 2.1 建立 `src/routes/infrastructure.tsx` 路由檔案，設定路由守衛與基本頁面結構
    - 使用 `createFileRoute('/infrastructure')` 建立路由
    - 在 `beforeLoad` 中使用 `requireAuth` 路由守衛
    - 靜態匯入 `amplify_outputs.json`
    - 建立 `InfrastructurePage` 元件，顯示頁面標題「AWS 資源連結」
    - 使用 MUI `Typography`、`Box`、`Container` 建立頁面骨架
    - _需求：1.1, 1.2, 1.3, 1.4, 6.4, 6.5_

  - [x] 2.2 實作 `ResourceItem` 輔助元件
    - 在 `infrastructure.tsx` 內部定義 `ResourceItem` 元件
    - 接受 `label`、`value`、`href?` props
    - 無 `href` 時以純文字顯示值
    - 有 `href` 時渲染為 MUI `Link`，附帶 `target="_blank"` 與 `rel="noopener noreferrer"`
    - 有 `href` 時顯示外部連結圖示（`OpenInNew` from `@mui/icons-material`）
    - 以標籤-值配對方式排列（標籤在左、值在右）
    - 缺少值時顯示「—」作為預設值
    - _需求：6.2, 6.3, 7.1, 7.2_

  - [x] 2.3 實作 Amazon Cognito 資源區段
    - 使用 MUI `Paper` 元件包裹區段
    - 顯示區段標題「Amazon Cognito」
    - 從 `amplify_outputs.json` 讀取 `auth.user_pool_id`、`auth.user_pool_client_id`、`auth.identity_pool_id`
    - User Pool ID 使用 `buildCognitoUserPoolUrl` 建構連結
    - App Client ID 以純文字顯示（無對應 Console 頁面）
    - Identity Pool ID 使用 `buildCognitoIdentityPoolUrl` 建構連結
    - 使用 optional chaining 安全存取欄位
    - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.4 實作 Amazon S3 資源區段
    - 使用 MUI `Paper` 元件包裹區段
    - 顯示區段標題「Amazon S3」
    - 從 `amplify_outputs.json` 讀取 `storage.bucket_name`、`storage.aws_region`
    - Bucket Name 使用 `buildS3BucketUrl` 建構連結
    - AWS Region 以純文字顯示
    - _需求：3.1, 3.2, 3.3, 3.4_

  - [x] 2.5 實作 AWS AppSync 資源區段
    - 使用 MUI `Paper` 元件包裹區段
    - 顯示區段標題「AWS AppSync」
    - 從 `amplify_outputs.json` 讀取 `data.url`、`data.aws_region`
    - GraphQL Endpoint 使用 `buildAppSyncUrl` 建構連結
    - AWS Region 以純文字顯示
    - _需求：4.1, 4.2, 4.3, 4.4_

  - [x] 2.6 實作 Amazon DynamoDB 資源區段
    - 使用 MUI `Paper` 元件包裹區段
    - 顯示區段標題「Amazon DynamoDB」
    - 從 `amplify_outputs.json` 讀取 `data.model_introspection.models` 中的所有模型名稱
    - 以純文字顯示各模型名稱（不附加連結，因無法判斷實際資料表名稱）
    - 列出所有模型：Customer、Supplier、Product、ProductVariant、Order、LineItem、PurchaseRecord
    - _需求：5.1, 5.2, 5.4_

- [x] 3. 檢查點 - 確認建置與基本功能
  - 確認 `npm run build` 通過，無型別錯誤
  - 確認路由檔案被 TanStack Router Vite 插件正確識別
  - 確保所有測試通過，如有問題請詢問使用者

- [ ] 4. 頁面渲染測試
  - [ ]\* 4.1 建立 `src/routes/__tests__/infrastructure.test.tsx` 單元測試
    - Mock `amplify_outputs.json` 的匯入，提供測試用固定值
    - 測試頁面標題「AWS 資源連結」正確顯示
    - 測試四個區段標題皆正確顯示（Amazon Cognito、Amazon S3、AWS AppSync、Amazon DynamoDB）
    - 測試資源值從 mock 資料正確讀取並顯示
    - 測試所有外部連結具有 `target="_blank"` 與 `rel="noopener noreferrer"`
    - 測試 DynamoDB 區段以純文字顯示模型名稱（無連結）
    - 測試缺少欄位時顯示「—」預設值
    - _需求：1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

- [x] 5. 最終檢查點 - 確認所有測試通過
  - 執行 `npm run build` 確認無型別錯誤
  - 執行 `npm run test` 確認所有測試通過
  - 確保所有測試通過，如有問題請詢問使用者

## 備註

- 標記 `*` 的任務為選擇性任務，可跳過以加速 MVP 開發
- 每個任務皆參照具體需求編號，確保可追溯性
- 本功能不使用屬性測試（Property-Based Testing），因為頁面為純 UI 展示，輸入空間固定且有限
- 所有 UI 文字使用繁體中文
- 樣式使用 MUI `sx` prop，與應用程式其他頁面保持一致
