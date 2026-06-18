# Requirements Document

## Introduction

本功能將系統的訂單資料模型從「Order → OrderItem[]」簡化為「一張訂單 = 一筆商品規格」的結構，並引入獨立的 Shipment（出貨單）實體管理多筆訂單的合併出貨。目標是降低資料模型複雜度，使訂單列表、採購流程、入庫流程、付款管理與出貨管理更貼近實際業務操作。

## Glossary

- **Order**：一筆客戶下單紀錄。一筆 Order 永遠只包含一個商品規格與數量，同時承擔原本 Order 與 OrderItem 的角色。Order 管理：客戶快照、商品快照、商品規格快照、數量、單價與成本快照、訂單金額、付款狀態、採購狀態、入庫狀態、是否缺貨、是否已出貨、訂單備註。
- **Shipment**：出貨單。一張 Shipment 可包含多筆 Order，用於支援合併出貨。Shipment 管理：出貨單號、收件人資訊快照、出貨狀態、物流方式、物流商追蹤碼、實際物流成本、出貨時間、出貨備註。
- **Shipment_Service**：負責出貨單建立、更新、狀態轉換與驗證的業務邏輯模組。
- **Order_Service**：負責訂單建立、狀態轉換、採購、入庫與驗證的業務邏輯模組。
- **ShipmentStatus**：出貨單的流程狀態，包含 PENDING（待出貨）、SHIPPED（已出貨）、DELIVERED（已送達）、CANCELLED（已取消）。
- **OrderFulfillmentStatus**：簡化後的訂單履約狀態，包含 PENDING（待處理）、ORDERED（已採購）、RECEIVED（已到貨）、SHIPPED（已出貨）、COMPLETED（已完成）、OUT_OF_STOCK（缺貨）、CANCELLED（已取消）。
- **合併出貨**：將多筆 Order 加入同一張 Shipment。系統不合併 Order 資料，不改變原始 Order 的 orderNumber，原始 Order 保留獨立資料，Shipment 僅作為出貨集合。

## Requirements

### 需求 1：Order 模型簡化

**User Story:** 身為系統開發者，我希望將 Order 模型簡化為一筆訂單只包含一個商品規格，以降低資料結構複雜度並貼合實際業務操作。

#### 驗收條件

1. THE Order_Service SHALL 在每筆 Order 中儲存以下欄位：orderNumber（string）、customerId（string）、customerNameSnapshot（string）、customerPhoneSnapshot（string）、customerEmailSnapshot（string）、shippingAddressSnapshot（string）、productId（string）、productNameSnapshot（string）、productSkuSnapshot（string）、productImageUrlSnapshot（string，可為 null）、selectedOptionsSnapshot（JSON 陣列）、quantity（integer）、unitPriceSnapshot（integer）、unitCostSnapshot（integer，可為 null）、totalPriceSnapshot（integer）、totalCostSnapshot（integer，可為 null）、subtotalAmount（integer）、shippingAmount（integer）、discountAmount（integer）、totalAmount（integer）、status（OrderFulfillmentStatus enum：PENDING、ORDERED、RECEIVED、SHIPPED、COMPLETED、OUT_OF_STOCK、CANCELLED）、paymentStatus（PaymentStatus enum：UNPAID、PAID、REFUNDED、PARTIALLY_REFUNDED）、supplierName（string，可為 null）、purchasedAt（ISO 8601 datetime，可為 null）、receivedAt（ISO 8601 datetime，可為 null）、shippedAt（ISO 8601 datetime，可為 null）、outOfStockAt（ISO 8601 datetime，可為 null）、paidAt（ISO 8601 datetime，可為 null）、cancelledAt（ISO 8601 datetime，可為 null）、refundedAt（ISO 8601 datetime，可為 null）、completedAt（ISO 8601 datetime，可為 null）、note（string，可為 null，最大長度 500 字元）、statusHistory（JSON 陣列，每筆包含 fromStatus、toStatus、changedAt）
2. THE Order_Service SHALL 確保每筆 Order 的 quantity 欄位為大於 0 且小於或等於 9999 的整數
3. THE Order_Service SHALL 確保每筆 Order 的 unitPriceSnapshot 與 unitCostSnapshot 欄位為大於或等於 0 且小於或等於 999,999,999 的整數
4. THE Order_Service SHALL 計算 totalPriceSnapshot 為 quantity 乘以 unitPriceSnapshot，並計算 totalCostSnapshot 為 quantity 乘以 unitCostSnapshot（當 unitCostSnapshot 為 null 時，totalCostSnapshot 亦為 null）
5. THE Order_Service SHALL 將 subtotalAmount 設為 totalPriceSnapshot 之值，並計算 totalAmount 為 subtotalAmount 加上 shippingAmount 再減去 discountAmount
6. WHEN 建立新 Order 時，THE Order_Service SHALL 自動產生格式為 `ORD-YYYYMMDD-XXXX`（YYYY 為西元年、MM 為月、DD 為日、XXXX 為 4 碼隨機英數字大寫）的唯一 orderNumber
7. IF quantity、unitPriceSnapshot 或 unitCostSnapshot 的值超出各自允許範圍，THEN THE Order_Service SHALL 拒絕該筆建立或更新操作，並回傳指出欄位名稱與違規原因的錯誤訊息
8. THE Order_Service SHALL 確保 shippingAmount 與 discountAmount 欄位為大於或等於 0 且小於或等於 999,999,999 的整數，且 discountAmount 不得大於 subtotalAmount 加 shippingAmount 之和

### 需求 2：移除 OrderItem 實體

**User Story:** 身為系統開發者，我希望移除獨立的 OrderItem 實體，因為簡化後的 Order 已直接包含商品規格與數量資訊。

#### 驗收條件

1. THE Order_Service SHALL 從 Amplify data schema 中移除 OrderItem model 定義及其相關的 secondaryIndexes、enum 引用與 hasMany/belongsTo 關聯
2. THE Order_Service SHALL 將原本 OrderItem 的所有欄位整合至 Order 模型中，使每筆 Order 直接包含商品快照欄位（productId、productNameSnapshot、productSkuSnapshot、productImageUrlSnapshot、selectedOptionsSnapshot）、數量與金額欄位（quantity、unitPriceSnapshot、unitCostSnapshot、totalPriceSnapshot、totalCostSnapshot）、狀態與時間戳記欄位（status、purchasedAt、receivedAt、shippedAt、outOfStockAt）、以及供應商名稱（supplierName）
3. WHEN 查詢訂單列表時，THE Order_Service SHALL 直接從 Order 返回商品規格與狀態資訊，不需額外關聯查詢
4. THE Order_Service SHALL 在 Order model 中保留 productId 資訊，並透過 ProductOrderSummary 機制支援依商品查詢訂單摘要，不再依賴 OrderItem 與 Product 之間的 hasMany/belongsTo 關聯
5. WHEN 移除 OrderItem model 後，THE Order_Service SHALL 同步移除或重構所有引用 OrderItem 的 custom mutation handler（confirmPurchase、cancelPurchase、confirmReceived、cancelReceived、confirmShipment、cancelShipment、confirmOutOfStock、cancelOutOfStock），使其改為操作 Order 的對應欄位

### 需求 3：訂單履約狀態管理

**User Story:** 身為營運人員，我希望在簡化後的訂單模型中仍能追蹤每筆訂單的採購、入庫與出貨進度。

#### 驗收條件

1. THE Order_Service SHALL 支援以下 OrderFulfillmentStatus 狀態值：PENDING、ORDERED、RECEIVED、SHIPPED、COMPLETED、OUT_OF_STOCK、CANCELLED
2. WHEN 營運人員對 Order 執行確認採購操作時，THE Order_Service SHALL 將 Order 狀態從 PENDING 轉換為 ORDERED，並記錄系統產生的 ISO 8601 purchasedAt 時間戳記與營運人員選取的 supplierName
3. WHEN 營運人員對 Order 執行確認入庫操作時，THE Order_Service SHALL 將 Order 狀態從 ORDERED 轉換為 RECEIVED，並記錄系統產生的 ISO 8601 receivedAt 時間戳記
4. WHEN 營運人員對 Order 執行確認出貨操作時，THE Order_Service SHALL 將 Order 狀態從 RECEIVED 轉換為 SHIPPED，並記錄系統產生的 ISO 8601 shippedAt 時間戳記
5. WHEN 訂單出貨完成時，THE Order_Service SHALL 將 Order 狀態從 SHIPPED 轉換為 COMPLETED，並記錄系統產生的 ISO 8601 completedAt 時間戳記
6. WHEN 營運人員對 Order 執行確認缺貨操作時，THE Order_Service SHALL 將 Order 狀態從 PENDING 或 ORDERED 轉換為 OUT_OF_STOCK，並記錄系統產生的 ISO 8601 outOfStockAt 時間戳記
7. WHEN 營運人員對 Order 執行取消操作時，THE Order_Service SHALL 將 Order 狀態從 PENDING、ORDERED、RECEIVED 或 OUT_OF_STOCK 轉換為 CANCELLED，並記錄系統產生的 ISO 8601 cancelledAt 時間戳記
8. IF 請求的狀態轉換不在允許的轉換路徑內，THEN THE Order_Service SHALL 拒絕操作、保留 Order 原有狀態不變，並回傳包含目前狀態與請求目標狀態的錯誤訊息
9. WHEN 任何狀態轉換成功時，THE Order_Service SHALL 將本次轉換記錄（含 fromStatus、toStatus、changedAt）附加至 Order 的 statusHistory 陣列

### 需求 4：Shipment 出貨單建立

**User Story:** 身為營運人員，我希望建立出貨單將多筆訂單集合在一起出貨，以提升出貨效率。

#### 驗收條件

1. THE Shipment_Service SHALL 在每筆 Shipment 中儲存以下欄位：shipmentNumber、recipientName（最大 100 字元）、recipientPhone（最大 30 字元）、recipientAddress（最大 200 字元）、status（ShipmentStatus）、shippingMethod（最大 50 字元）、trackingNumber（最大 100 字元）、actualShippingCost（0 至 999,999 的整數）、shippedAt、deliveredAt、cancelledAt、note（最大 500 字元）
2. WHEN 建立新 Shipment 時，THE Shipment_Service SHALL 透過 SequenceCounter 自動產生唯一且遞增的 shipmentNumber
3. WHEN 建立新 Shipment 時，THE Shipment_Service SHALL 將初始狀態設為 PENDING
4. THE Shipment_Service SHALL 支援將 1 筆至最多 50 筆 Order 關聯至同一筆 Shipment
5. WHEN 將 Order 加入 Shipment 時，THE Shipment_Service SHALL 驗證該 Order 的 status 為 RECEIVED（已到貨且未出貨）
6. IF Order 的 status 不為 RECEIVED，THEN THE Shipment_Service SHALL 拒絕將該 Order 加入 Shipment，並回傳包含該 Order 的 orderNumber 與目前 status 的錯誤訊息
7. WHEN 建立新 Shipment 時，THE Shipment_Service SHALL 要求至少包含一筆 status 為 RECEIVED 的 Order，否則拒絕建立並回傳錯誤訊息

### 需求 5：Shipment 出貨單狀態管理

**User Story:** 身為營運人員，我希望追蹤出貨單的物流狀態，掌握每批貨物的運送進度。

#### 驗收條件

1. THE Shipment_Service SHALL 支援以下 ShipmentStatus 狀態值：PENDING、SHIPPED、DELIVERED、CANCELLED
2. WHEN 確認出貨時，THE Shipment_Service SHALL 在單一 DynamoDB 交易中將 Shipment 狀態從 PENDING 轉換為 SHIPPED，並記錄 ISO 8601 格式的 shippedAt 時間戳記
3. WHEN 確認出貨時，THE Shipment_Service SHALL 同時將該 Shipment 下所有關聯 Order 的狀態轉換為 SHIPPED，並記錄各 Order 的 shippedAt 時間戳記
4. WHEN 確認送達時，THE Shipment_Service SHALL 將 Shipment 狀態從 SHIPPED 轉換為 DELIVERED，並記錄 ISO 8601 格式的 deliveredAt 時間戳記
5. WHEN 確認送達時，THE Shipment_Service SHALL 同時將該 Shipment 下所有關聯 Order 的狀態轉換為 COMPLETED，並記錄各 Order 的 completedAt 時間戳記
6. WHEN 取消出貨單時，THE Shipment_Service SHALL 將 Shipment 狀態從 PENDING 轉換為 CANCELLED，並記錄 ISO 8601 格式的 cancelledAt 時間戳記
7. WHEN 取消出貨單時，THE Shipment_Service SHALL 同時將該 Shipment 下所有關聯 Order 的狀態回退為 RECEIVED
8. IF 狀態轉換不在允許的轉換路徑內，THEN THE Shipment_Service SHALL 拒絕操作並回傳包含目前狀態與請求目標狀態的錯誤訊息
9. IF 確認出貨或取消出貨的交易因資料競爭條件而失敗（TransactionCanceledException），THEN THE Shipment_Service SHALL 回傳提示使用者重新取得最新資料後重試的錯誤訊息，且不產生任何部分寫入

### 需求 6：合併出貨規則

**User Story:** 身為營運人員，我希望將同一客戶或同一收件地址的多筆訂單合併出貨，以節省物流成本。

#### 驗收條件

1. THE Shipment_Service SHALL 允許將多筆不同 Order 加入同一筆 Shipment，不限制 Order 是否屬於同一客戶
2. THE Shipment_Service SHALL 保留每筆 Order 的獨立資料與 orderNumber，不合併或修改原始 Order 的內容
3. WHEN 將 Order 加入 Shipment 時，THE Shipment_Service SHALL 記錄 Order 與 Shipment 之間的關聯（透過 Order 的 shipmentId 欄位）
4. THE Shipment_Service SHALL 允許一筆 Order 最多只關聯一筆未取消的 Shipment
5. IF 一筆 Order 已關聯至一筆未取消的 Shipment，THEN THE Shipment_Service SHALL 拒絕將該 Order 加入另一筆 Shipment，並回傳包含該 Order 的 orderNumber 與已關聯 shipmentNumber 的錯誤訊息
6. WHEN 從 PENDING 狀態的 Shipment 移除 Order 時，THE Shipment_Service SHALL 解除該 Order 與 Shipment 的關聯（清除 Order 的 shipmentId），但不改變 Order 的 status
7. IF Shipment 狀態不為 PENDING，THEN THE Shipment_Service SHALL 拒絕從該 Shipment 移除 Order 的操作

### 需求 7：出貨庫存驗證

**User Story:** 身為營運人員，我希望系統在出貨前驗證庫存充足，避免超賣。

#### 驗收條件

1. WHEN 確認 Shipment 出貨時，THE Shipment_Service SHALL 針對該 Shipment 下所有 Order，以 Product 層級彙總各商品的出貨數量（各 Order 的 quantity 總和），並驗證每項商品的彙總出貨數量不超過該商品目前的 stockQuantity
2. IF 任一商品的彙總出貨數量超過該商品目前的 stockQuantity，THEN THE Shipment_Service SHALL 拒絕出貨並回傳錯誤訊息，列出每項庫存不足商品的名稱、要求數量與目前庫存數量
3. WHEN 出貨驗證通過時，THE Shipment_Service SHALL 在同一筆 DynamoDB 交易中完成庫存驗證與扣減，將每項商品的 stockQuantity 減去該商品在本次 Shipment 中的彙總出貨數量
4. WHEN 取消狀態為 SHIPPED 的 Shipment 時，THE Shipment_Service SHALL 將該 Shipment 下所有 Order 對應商品的 stockQuantity 加回各 Order 的 quantity
5. IF 出貨交易過程中庫存已被其他操作變更導致交易失敗，THEN THE Shipment_Service SHALL 拒絕出貨並回傳錯誤訊息，指示營運人員重新取得最新資料後重試

### 需求 8：Shipment 查詢與列表

**User Story:** 身為營運人員，我希望能查詢與瀏覽出貨單列表，以管理出貨進度。

#### 驗收條件

1. THE Shipment_Service SHALL 支援依建立時間由新至舊（降冪）排序查詢所有 Shipment，並以分頁方式返回結果，每頁最多 20 筆
2. THE Shipment_Service SHALL 支援依單一 ShipmentStatus（PENDING、SHIPPED、DELIVERED、CANCELLED）篩選 Shipment 列表
3. THE Shipment_Service SHALL 支援依 shipmentNumber 精確比對查詢單筆 Shipment
4. WHEN 查詢單筆 Shipment 時，THE Shipment_Service SHALL 返回該 Shipment 下所有關聯 Order 的摘要資訊（orderNumber、customerNameSnapshot、productNameSnapshot、quantity、totalAmount）
5. IF 依 shipmentNumber 查詢時查無對應 Shipment，THEN THE Shipment_Service SHALL 回傳描述性錯誤訊息表示該出貨單不存在
6. IF 查詢結果為空（無符合條件的 Shipment），THEN THE Shipment_Service SHALL 回傳空列表而非錯誤

### 需求 9：訂單查詢適配

**User Story:** 身為營運人員，我希望在簡化模型後仍能以多種維度查詢訂單，確保日常作業效率不受影響。

#### 驗收條件

1. THE Order_Service SHALL 支援依建立時間由新至舊（降冪）排序查詢所有 Order，並以分頁方式返回結果，每頁最多 20 筆
2. THE Order_Service SHALL 支援依 customerId 篩選 Order 列表
3. THE Order_Service SHALL 支援依 OrderFulfillmentStatus 篩選 Order 列表
4. THE Order_Service SHALL 支援依 paymentStatus 篩選 Order 列表
5. THE Order_Service SHALL 支援依 productId 篩選 Order 列表
6. THE Order_Service SHALL 支援依 orderNumber 精確比對查詢單筆 Order
7. IF 依 orderNumber 查詢時查無對應 Order，THEN THE Order_Service SHALL 回傳描述性錯誤訊息表示該訂單不存在
8. IF 查詢結果為空（無符合條件的 Order），THEN THE Order_Service SHALL 回傳空列表而非錯誤

### 需求 10：Demo Scripts 更新

**User Story:** 身為系統開發者，我希望 demo scripts（`scripts/seed-demo-data.mjs`、`scripts/clear-demo-data.mjs` 與各 rebuild summary 腳本）能配合新的資料模型產生與重建正確的資料，以便在開發環境中驗證功能。

#### 驗收條件

1. WHEN 執行 seed-demo-data 腳本時，THE seed script SHALL 產生符合新 Order 模型的假資料，每筆 Order 直接包含商品快照欄位（productId、productNameSnapshot、productSkuSnapshot、productImageUrlSnapshot、selectedOptionsSnapshot）、數量與金額欄位（quantity、unitPriceSnapshot、unitCostSnapshot、totalPriceSnapshot、totalCostSnapshot）、狀態與時間戳記欄位（status、purchasedAt、receivedAt、shippedAt、outOfStockAt）、以及 supplierName，不再產生獨立的 OrderItem 記錄
2. WHEN 執行 seed-demo-data 腳本時，THE seed script SHALL 產生 Shipment 假資料，包含不同 ShipmentStatus（PENDING、SHIPPED、DELIVERED、CANCELLED）的出貨單，每筆 Shipment 關聯 1 至 5 筆狀態為 RECEIVED 或已出貨的 Order
3. WHEN 執行 seed-demo-data 腳本時，THE seed script SHALL 確保被關聯至 Shipment 的 Order 其 shipmentId 欄位正確指向對應的 Shipment id
4. THE seed script SHALL 移除對 OrderItem DynamoDB table 的寫入操作，並從 loadTableNames 中移除 orderItem 資料表的引用
5. THE seed script SHALL 更新 validateSeedConsistency 函式，使其驗證新 Order 模型的欄位完整性（含商品快照、金額計算、狀態一致性）以及 Shipment 與 Order 的關聯正確性
6. WHEN 執行 clear-demo-data 腳本時，THE clear script SHALL 清除 Shipment 資料表的所有記錄，移除對 OrderItem 資料表的清除操作，並保留對其他資料表的既有清除邏輯
7. THE seed script SHALL 在執行結束時輸出的摘要 JSON 中包含 shipments 數量，不再包含 orderItems 數量
8. THE seed script SHALL 確保產生的 Shipment 假資料中，狀態為 SHIPPED 的 Shipment 其下所有關聯 Order 的 status 為 SHIPPED 且 shippedAt 已填入，狀態為 DELIVERED 的 Shipment 其下所有關聯 Order 的 status 為 COMPLETED 且 completedAt 已填入
9. THE rebuild-product-order-summaries 腳本 SHALL 改為掃描 Order 資料表（取代原本的 OrderItem 資料表），依每筆 Order 的 productId、status 與 quantity 欄位重新聚合 ProductOrderSummary，並從 loadTableNames 中移除 orderItem 的引用
10. THE rebuild-supplier-order-summaries 腳本 SHALL 改為掃描 Order 資料表（取代原本的 OrderItem 資料表），依每筆 Order 的 supplierName、status 與 quantity 欄位重新聚合 SupplierOrderSummary，並從 loadTableNames 中移除 orderItem 的引用
11. THE rebuild-customer-order-summaries 腳本 SHALL 改為僅掃描 Order 資料表（不再掃描 OrderItem 資料表），直接從 Order 取得商品與金額資訊重新聚合 CustomerOrderSummary，並從 loadTableNames 中移除 orderItem 的引用
12. THE 各 rebuild summary 腳本中的 validateSummaryConsistency 函式 SHALL 改為依據 Order 資料（而非 OrderItem 資料）驗證摘要聚合結果的正確性
