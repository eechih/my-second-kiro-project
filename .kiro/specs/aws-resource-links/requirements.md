# 需求文件

## 簡介

新增一個「AWS 資源連結」頁面，讓已驗證使用者可以快速瀏覽專案中所有 AWS 資源的資訊，並透過可點擊的連結直接開啟對應的 AWS Console 頁面。此頁面將從 `amplify_outputs.json` 讀取資源設定，以分區段方式呈現 Amazon Cognito、Amazon S3、AWS AppSync 及 Amazon DynamoDB 的資源資訊。

## 術語表

- **Resource_Links_Page**：AWS 資源連結頁面，顯示所有 AWS 資源資訊與 Console 連結的受保護路由頁面
- **AWS_Console_Link**：指向 AWS Management Console 中特定資源頁面的超連結
- **Amplify_Outputs**：`amplify_outputs.json` 檔案，包含 Amplify Gen2 部署後產生的所有 AWS 資源識別碼與端點資訊
- **Resource_Section**：頁面中按 AWS 服務分類的資訊區塊（如 Cognito 區段、S3 區段等）
- **Resource_Item**：單一 AWS 資源的資訊列，包含標籤、值與可選的 Console 連結

## 需求

### 需求 1：頁面路由與存取控制

**使用者故事：** 身為已驗證使用者，我希望透過導覽列進入 AWS 資源連結頁面，以便快速查看專案的基礎設施資訊。

#### 驗收條件

1. Resource_Links_Page 應可透過路由路徑 `/infrastructure` 存取
2. 當未驗證使用者嘗試存取 `/infrastructure` 時，Resource_Links_Page 應將使用者重新導向至首頁
3. 當已驗證使用者導覽至 `/infrastructure` 時，Resource_Links_Page 應顯示頁面內容，標題為「AWS 資源連結」
4. Resource_Links_Page 應在 `beforeLoad` 中使用 `requireAuth` 路由守衛來強制驗證

### 需求 2：Amazon Cognito 資源區段

**使用者故事：** 身為已驗證使用者，我希望在頁面上看到 Amazon Cognito 的資源資訊與 Console 連結，以便快速存取使用者池設定。

#### 驗收條件

1. Resource_Links_Page 應顯示一個「Amazon Cognito」區段，包含區段標題
2. Resource_Links_Page 應顯示從 Amplify_Outputs 讀取的 User Pool ID 值
3. Resource_Links_Page 應顯示從 Amplify_Outputs 讀取的 App Client ID 值
4. Resource_Links_Page 應顯示從 Amplify_Outputs 讀取的 Identity Pool ID 值
5. 當使用者點擊 User Pool ID 連結時，AWS_Console_Link 應在新分頁中開啟 Cognito User Pool 頁面，URL 格式為 `https://{region}.console.aws.amazon.com/cognito/v2/idp/user-pools/{userPoolId}/users`
6. 當使用者點擊 Identity Pool ID 連結時，AWS_Console_Link 應在新分頁中開啟 Cognito Identity Pool 頁面，URL 格式為 `https://{region}.console.aws.amazon.com/cognito/v2/identity/identity-pools/{identityPoolId}`

### 需求 3：Amazon S3 資源區段

**使用者故事：** 身為已驗證使用者，我希望在頁面上看到 Amazon S3 的儲存桶資訊與 Console 連結，以便快速存取儲存桶內容。

#### 驗收條件

1. Resource_Links_Page 應顯示一個「Amazon S3」區段，包含區段標題
2. Resource_Links_Page 應顯示從 Amplify_Outputs 讀取的 Bucket Name 值
3. Resource_Links_Page 應顯示儲存桶的 AWS Region 值
4. 當使用者點擊 Bucket Name 連結時，AWS_Console_Link 應在新分頁中開啟 S3 儲存桶頁面，URL 格式為 `https://s3.console.aws.amazon.com/s3/buckets/{bucketName}`

### 需求 4：AWS AppSync 資源區段

**使用者故事：** 身為已驗證使用者，我希望在頁面上看到 AWS AppSync GraphQL API 的資訊與 Console 連結，以便快速存取 API 設定。

#### 驗收條件

1. Resource_Links_Page 應顯示一個「AWS AppSync」區段，包含區段標題
2. Resource_Links_Page 應顯示從 Amplify_Outputs 讀取的 GraphQL Endpoint URL
3. Resource_Links_Page 應顯示 AppSync API 的 AWS Region 值
4. 當使用者點擊 GraphQL Endpoint 連結時，AWS_Console_Link 應在新分頁中開啟 AppSync 主控台 API 列表頁面，URL 格式為 `https://{region}.console.aws.amazon.com/appsync/home?region={region}#/apis`

### 需求 5：Amazon DynamoDB 資源區段

**使用者故事：** 身為已驗證使用者，我希望在頁面上看到所有 DynamoDB 資料表名稱與 Console 連結，以便快速存取各資料表。

#### 驗收條件

1. Resource_Links_Page 應顯示一個「Amazon DynamoDB」區段，包含區段標題
2. Resource_Links_Page 應列出 Amplify_Outputs 中定義的所有資料模型名稱（Customer、Supplier、Product、ProductVariant、Order、LineItem、PurchaseRecord）
3. 當使用者點擊 DynamoDB 資料表名稱連結時，AWS_Console_Link 應在新分頁中開啟 DynamoDB 資料表頁面，URL 格式為 `https://{region}.console.aws.amazon.com/dynamodbv2/home?region={region}#table?name={tableName}`
4. 若無法從 Amplify_Outputs 判斷資料表名稱，則 Resource_Links_Page 應以純文字顯示模型名稱，不附加連結

### 需求 6：頁面佈局與 UI 呈現

**使用者故事：** 身為已驗證使用者，我希望頁面以清晰的分區段方式呈現資源資訊，以便快速找到所需的資源連結。

#### 驗收條件

1. Resource_Links_Page 應使用 MUI Card 或 Paper 元件將每個 AWS 服務顯示為獨立的視覺區段
2. Resource_Links_Page 應以標籤-值配對方式顯示資源資訊，標籤在左、值在右
3. Resource_Links_Page 應為所有 AWS_Console_Link 加上視覺指示器（外部連結圖示），表示將在新分頁開啟
4. Resource_Links_Page 應以繁體中文顯示所有 UI 文字
5. Resource_Links_Page 應使用現有的 MUI 主題與 `sx` prop 樣式，與應用程式中其他頁面保持一致

### 需求 7：連結行為與安全性

**使用者故事：** 身為已驗證使用者，我希望所有外部連結都在新分頁開啟，且不會洩漏頁面資訊，以確保安全性。

#### 驗收條件

1. AWS_Console_Link 應使用 `target="_blank"` 在新分頁中開啟
2. AWS_Console_Link 應包含 `rel="noopener noreferrer"` 屬性以防止 tab-napping 攻擊
3. Resource_Links_Page 應在建置時從匯入的 `amplify_outputs.json` 檔案讀取資源識別碼
4. Resource_Links_Page 應使用 Amplify_Outputs 中的 region 與資源識別碼建構 AWS Console URL，不進行任何執行時期 API 呼叫
