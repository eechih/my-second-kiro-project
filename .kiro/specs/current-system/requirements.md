# 系統需求規格書

> 依據程式碼現況歸納，反映已實作功能。最後更新：2026-06-22

---

## 1. 系統概述

本系統為基於 AWS Amplify Gen 2 的 React SPA 電子商務訂單管理系統，服務內部營運人員處理客戶、商品、供應商與訂單履約流程。所有 UI 文案使用繁體中文。

### 核心流程

```
客戶下單 → 確認採購 → 入庫確認 → 出貨 → 完成
                ↘ 缺貨 ↗
```

### 系統模組

| 模組 | 路徑 | 說明 |
|------|------|------|
| 儀表板 | `/` | 待處理、待入庫、待出貨摘要 |
| 訂單管理 | `/orders` | 訂單 CRUD、狀態追蹤 |
| 商品管理 | `/products` | 商品 CRUD、規格、照片、庫存 |
| 單品採購 | `/product-purchases` | 以商品角度管理採購流程 |
| 供應商管理 | `/suppliers` | 供應商 CRUD |
| 供應商入庫 | `/supplier-receivings` | 以供應商角度管理入庫 |
| 客戶管理 | `/customers` | 客戶 CRUD |
| 客戶出貨 | `/customer-shipments` | 以客戶角度管理出貨、建立出貨單 |
| 基礎設施 | `/infrastructure` | Amplify 資源檢視 |

---

## 2. 認證與授權

- 認證方式：Email / 密碼（AWS Cognito User Pool）
- 所有頁面受保護，未登入重新導向至登入頁
- 所有 API 操作需 authenticated user（`allow.authenticated()`）

---

## 3. 客戶管理

### 3.1 資料模型

| 欄位 | 型別 | 說明 |
|------|------|------|
| name | string（必填） | 客戶名稱 |
| phone | string | 電話 |
| email | string | Email |
| address | string | 地址 |
| note | string | 備註 |
| isActive | boolean | 啟用狀態（軟刪除） |
| orderCount | integer | 累積下單次數 |
| lastOrderedAt | datetime | 最近下單時間 |

### 3.2 功能

- 客戶列表：搜尋、排序（建立日期、最近下單、下單次數）
- 新增 / 編輯 / 停用客戶
- 驗證規則：名稱為必填

---

## 4. 供應商管理

### 4.1 資料模型

| 欄位 | 型別 | 說明 |
|------|------|------|
| name | string（必填） | 供應商名稱 |
| phone | string | 電話 |
| email | string | Email |
| address | string | 地址 |
| translationParser | string | FB 貼文解析器 key |
| note | string | 備註 |
| isActive | boolean | 啟用狀態 |

### 4.2 功能

- 供應商列表：搜尋、排序
- 新增 / 編輯 / 停用供應商
- FB 貼文翻譯解析（支援 8 個供應商格式：Wish、葉貓子、Money、生意興隆、吉田、米塔購、天魁）
- 供應商詳情頁附帶入庫管理面板

---

## 5. 商品管理

### 5.1 資料模型

| 欄位 | 型別 | 說明 |
|------|------|------|
| name | string（必填） | 商品名稱 |
| sku | string（必填，系統自動產生） | SKU 編號 |
| sequenceNumber | integer | 流水號 |
| price | integer（必填） | 預設售價 |
| cost | integer（必填） | 預設成本 |
| stockQuantity | integer | 庫存數量 |
| defaultSupplierId | string | 預設供應商 |
| imageUrls | string[] | 商品照片 S3 key |
| preorderStatus | OPEN / CLOSED | 預購狀態 |
| isActive | boolean | 啟用狀態 |
| options | ProductOption[] | 規格維度 |

### 5.2 商品規格

- ProductOption：規格維度（如「顏色」、「尺寸」）
- ProductOptionValue：規格值（如「紅色」、「XL」），含 priceOffset / costOffset

### 5.3 功能

- 商品列表：搜尋、狀態篩選（啟用/停用/全部）
- 新增商品（SKU 自動產生 via Lambda + SequenceCounter）
- 編輯商品資訊、規格維度與規格值
- 商品照片上傳（S3）、縮圖自動產生（Lambda）
- 庫存管理（入庫自動增加、出貨自動扣減）

---

## 6. 訂單管理

### 6.1 資料模型（扁平化：一筆 Order = 一個商品）

| 欄位 | 型別 | 說明 |
|------|------|------|
| orderNumber | string | 訂單編號（ORD-YYYYMMDD-XXXX） |
| customerId | string | 客戶 ID |
| customerNameSnapshot | string | 客戶名稱快照 |
| productId | string | 商品 ID |
| productNameSnapshot | string | 商品名稱快照 |
| productSkuSnapshot | string | 商品 SKU 快照 |
| selectedOptionsSnapshot | JSON | 規格選取快照 |
| quantity | integer（1–9999） | 數量 |
| unitPriceSnapshot | integer | 單價 |
| unitCostSnapshot | integer | 成本 |
| status | OrderFulfillmentStatus | 履約狀態 |
| paymentStatus | PaymentStatus | 付款狀態 |
| supplierName | string | 供應商名稱 |
| shipmentId | string | 關聯出貨單 |
| statusHistory | JSON | 狀態變更歷史 |

### 6.2 訂單履約狀態機

```
PENDING → ORDERED → RECEIVED → SHIPPED → COMPLETED
   ↓         ↓         ↓
OUT_OF_STOCK  OUT_OF_STOCK  CANCELLED
   ↓
CANCELLED    CANCELLED
```

允許的轉換：
- PENDING → ORDERED, OUT_OF_STOCK, CANCELLED
- ORDERED → RECEIVED, OUT_OF_STOCK, CANCELLED
- RECEIVED → SHIPPED, CANCELLED
- SHIPPED → COMPLETED
- OUT_OF_STOCK → CANCELLED
- COMPLETED, CANCELLED → 終態

### 6.3 付款狀態

UNPAID → PAID → REFUNDED / PARTIALLY_REFUNDED

### 6.4 訂單列表功能

- 搜尋（訂單編號、客戶名稱）
- 狀態篩選
- 游標分頁（CursorPaginationBar：頁碼跳頁、偏好設定）
- 點擊跳轉訂單詳情

### 6.5 訂單建立

- 選取客戶
- 選取商品與規格
- 自動快照客戶/商品/價格資訊
- 自動計算金額（subtotal + shipping - discount = total）

### 6.6 Custom Mutations（批次操作，上限 20 筆）

| Mutation | 參數 | 說明 |
|----------|------|------|
| confirmPurchase | orderIds[], supplierName | 確認採購（PENDING → ORDERED） |
| cancelPurchase | orderIds[] | 取消採購（ORDERED → PENDING） |
| confirmReceived | orderIds[] | 入庫確認（ORDERED → RECEIVED），庫存 +qty |
| cancelReceived | orderIds[] | 取消入庫（RECEIVED → ORDERED），庫存 -qty |
| confirmShipment | orderId | 直接出貨（RECEIVED → SHIPPED），庫存 -qty |
| cancelShipment | orderId | 取消出貨（SHIPPED → RECEIVED），庫存 +qty |
| confirmOutOfStock | orderIds[] | 確認缺貨（PENDING/ORDERED → OUT_OF_STOCK） |
| cancelOutOfStock | orderIds[] | 取消缺貨（OUT_OF_STOCK → 回退前狀態） |

### 6.7 金額驗證規則

- quantity：1–9999，整數
- unitPriceSnapshot / unitCostSnapshot：0–999,999,999，整數
- shippingAmount：0–999,999,999
- discountAmount：0–999,999,999，且 ≤ subtotal + shipping

---

## 7. 出貨單管理

### 7.1 資料模型

| 欄位 | 型別 | 說明 |
|------|------|------|
| shipmentNumber | string | 出貨單號（流水號） |
| recipientName | string（必填） | 收件人 |
| recipientPhone | string | 收件電話 |
| recipientAddress | string | 收件地址 |
| status | ShipmentStatus | 出貨狀態 |
| shippingMethod | string | 寄送方式 |
| trackingNumber | string | 追蹤碼 |
| actualShippingCost | integer | 實際物流成本 |

### 7.2 出貨單狀態機

- PENDING → SHIPPED, CANCELLED
- SHIPPED → DELIVERED
- DELIVERED, CANCELLED → 終態

### 7.3 Custom Mutations

| Mutation | 說明 |
|----------|------|
| createShipmentWithOrders | 建立出貨單 + 關聯多筆 RECEIVED 訂單（1–50 筆） |
| confirmShipmentDispatch | 出貨確認（PENDING → SHIPPED），扣庫存 |
| confirmShipmentDelivery | 送達確認（SHIPPED → DELIVERED），訂單 → COMPLETED |
| cancelShipmentOrder | 取消出貨單（回退訂單狀態，回補庫存） |
| addOrderToShipment | 追加訂單至出貨單 |
| removeOrderFromShipment | 從出貨單移除訂單 |

### 7.4 出貨驗證規則

- 訂單必須為 RECEIVED 狀態才能加入出貨單
- 庫存必須充足（依 productId 彙總驗證）
- 訂單不可重複關聯至未取消的出貨單
- 出貨單包含 1–50 筆訂單

---

## 8. 單品採購模組

### 8.1 功能

- 商品摘要列表：顯示每個商品的待處理/已採購/已到貨數量
- 狀態篩選：待處理 / 已採購
- 欄位排序：SKU、供應商、待處理、已採購、最後更新
- 展開行（master-detail）：顯示該商品的待處理訂單明細
- 批次操作：確認訂貨、取消訂貨、標記缺貨、取消缺貨
- 作業明細頁：產品摘要卡片 + 訂單列表 + 編輯/刪除

### 8.2 效能設計

- `supplierStatusSort` 複合 SK GSI（PK=supplierName, SK=${status}#${createdAtForSort}）
- 查詢特定供應商的特定狀態訂單使用 `begins_with`

---

## 9. 供應商入庫模組

### 9.1 功能

- 供應商摘要列表：顯示各供應商的待入庫/已入庫數量
- 入庫管理面板（嵌入供應商詳情頁）
- 狀態篩選：全部 / 待入庫 / 已入庫
- 欄位排序：訂單編號、客戶、商品、狀態、訂貨日、到貨日
- 批次操作：確認入庫、取消入庫（單一 Transaction，含庫存同步）
- 分頁：25/50/100 筆每頁（MUI TablePagination）

### 9.2 效能設計

- 使用 `bySupplierStatus` GSI + `begins_with("ORDERED#")` 精準查詢
- 對比全表 Scan：RCU 降低 50–100 倍

---

## 10. 客戶出貨模組

### 10.1 功能

- 客戶摘要列表：顯示各客戶的可出貨/已出貨訂單數
- 出貨管理面板
- 欄位排序：訂單編號、商品、狀態、到貨日、出貨日
- 批次勾選 + 建立出貨單（對話框填寫收件資訊 → 呼叫 createShipmentWithOrders）
- 批次直接出貨（不建出貨單，直接標記 SHIPPED）
- 出貨單紀錄列表（從訂單的 shipmentId 反查 Shipment 顯示）
- 分頁：25/50/100 筆每頁

### 10.2 效能設計

- `customerStatusSort` 複合 SK GSI（PK=customerId, SK=${status}#${createdAtForSort}）
- 出貨管理「可出貨」模式使用 `begins_with("RECEIVED#")` 精準查詢

---

## 11. 儀表板

### 11.1 摘要數據

| 指標 | 說明 |
|------|------|
| pendingOrdersCount | 待處理訂單（status = PENDING） |
| pendingProcurementCount | 待入庫訂單（status = ORDERED） |
| readyToShipOrderItemsCount | 待出貨訂單（status = RECEIVED） |

- 每 30 秒自動重新查詢

---

## 12. 摘要同步機制

所有訂單狀態變更的 Lambda 都會在同一 Transaction 中同步更新三張摘要表：

| 摘要表 | PK | 用途 |
|--------|-----|------|
| CustomerOrderSummary | customerId | 客戶出貨列表 |
| ProductOrderSummary | productId | 單品採購列表 |
| SupplierOrderSummary | supplierName | 供應商入庫列表 |

---

## 13. 基礎設施

### 13.1 後端資源

- AWS Cognito（認證）
- AWS AppSync（GraphQL API）
- Amazon DynamoDB（資料儲存，10+ 張表）
- Amazon S3（商品照片）
- AWS Lambda（20 個函式）

### 13.2 GSI 索引策略

| GSI | PK | SK | 用途 |
|-----|----|----|------|
| byCreatedAt | gsiPartition | createdAtForSort | 依建立日期列表 |
| byCustomer | customerId | createdAtForSort | 客戶訂單 |
| byStatus | status | createdAtForSort | 依狀態篩選 |
| byProductId | productId | createdAtForSort | 商品訂單 |
| bySupplierStatus | supplierName | supplierStatusSort | 供應商入庫查詢 |
| byCustomerStatus | customerId | customerStatusSort | 客戶出貨查詢 |
| byShipmentId | shipmentId | — | 出貨單訂單查詢 |

### 13.3 Demo Scripts

| 腳本 | 說明 |
|------|------|
| seed-demo-data.mjs | 產生測試假資料 |
| clear-demo-data.mjs | 清除測試資料 |
| rebuild-product-order-summaries.mjs | 重建 ProductOrderSummary |
| rebuild-customer-order-summaries.mjs | 重建 CustomerOrderSummary |
| rebuild-supplier-order-summaries.mjs | 重建 SupplierOrderSummary |

---

## 14. 非功能需求

### 14.1 效能

- 批次操作上限 20 筆（DynamoDB Transaction 100 items 限制）
- 複合 SK GSI 避免全表掃描
- TanStack Query 快取 + 樂觀更新

### 14.2 一致性

- 所有狀態變更使用 DynamoDB TransactWriteItems（原子性）
- 庫存與訂單狀態在同一交易內同步
- 摘要表在同一交易內更新

### 14.3 安全

- 所有 mutation 需 authenticated
- Lambda 使用最小權限 IAM
- S3 存取規則限制

### 14.4 UI/UX

- MUI v6 + Emotion（sx prop）
- 緊湊表格（size="small"）
- 操作按鈕顯示 loading spinner（僅被點擊的按鈕）
- 批次操作支援 checkbox 全選
- 排序、篩選、分頁
- 展開行（master-detail）
- 繁體中文錯誤訊息
