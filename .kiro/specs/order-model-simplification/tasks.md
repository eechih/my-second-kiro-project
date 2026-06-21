# Implementation Plan: Order Model Simplification

## Overview

本實作計畫將「訂單模型簡化」功能拆解為可依序執行的程式碼任務。核心工作包括：重構 shared models/logic 為扁平化 Order 結構、移除 OrderItem、新增 Shipment 實體與狀態機、重構 Amplify schema 與 Lambda handlers、更新 demo scripts。所有變更以 TypeScript 實作，測試使用 Vitest + fast-check。

## Tasks

- [x] 1. 重構 Shared Models — Order 扁平化與 Shipment 新增
  - [x] 1.1 重構 `shared/models/order.ts`：移除 `OrderItem` interface、`OrderItemStatus` 型別與相關常數；擴充 `Order` interface 整合原 OrderItem 欄位（productId、productNameSnapshot、productSkuSnapshot、productImageUrlSnapshot、selectedOptionsSnapshot、quantity、unitPriceSnapshot、unitCostSnapshot、totalPriceSnapshot、totalCostSnapshot、supplierName、purchasedAt、receivedAt、shippedAt、outOfStockAt、shipmentId）；新增 `OrderFulfillmentStatus` 型別；更新 `CreateOrderInput` 為扁平結構
    - 移除 `OrderItem`、`OrderItemStatus` 與相關 export
    - 新增 `OrderFulfillmentStatus = 'PENDING' | 'ORDERED' | 'RECEIVED' | 'SHIPPED' | 'COMPLETED' | 'OUT_OF_STOCK' | 'CANCELLED'`
    - 新增 `PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED'`
    - 確保 `statusHistory` 欄位為 `{ fromStatus: string; toStatus: string; changedAt: string }[]`
    - _Requirements: 1.1, 2.1, 2.2_

  - [x] 1.2 新增 `shared/models/shipment.ts`：定義 `ShipmentStatus` 型別、`Shipment` interface、`ShipmentOrderSummary` interface、`CreateShipmentInput` 型別
    - `ShipmentStatus = 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'`
    - `Shipment` 包含 shipmentNumber、recipientName、recipientPhone、recipientAddress、status、shippingMethod、trackingNumber、actualShippingCost、shippedAt、deliveredAt、cancelledAt、note
    - `ShipmentOrderSummary` 包含 orderNumber、customerNameSnapshot、productNameSnapshot、quantity、totalAmount
    - _Requirements: 4.1, 8.4_

- [x] 2. 重構 Shared Logic — Order 狀態機與計算
  - [x] 2.1 重構 `shared/logic/order-status.ts`：重寫 `ALLOWED_TRANSITIONS` 為新狀態機（PENDING→ORDERED/OUT_OF_STOCK/CANCELLED, ORDERED→RECEIVED/OUT_OF_STOCK/CANCELLED, RECEIVED→SHIPPED/CANCELLED, SHIPPED→COMPLETED, OUT_OF_STOCK→CANCELLED）；移除 `deriveOrderStatusFromOrderItems()`；保留並更新 `isValidOrderStatusTransition()` 與 `getNextAllowedOrderStatuses()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 2.2 重構 `shared/logic/order-calculations.ts`：改為單筆 Order 金額計算 — `calculateTotalPrice(quantity, unitPrice)`、`calculateTotalCost(quantity, unitCost)` (null-safe)、`calculateTotalAmount(subtotal, shipping, discount)`；新增 `validateOrderFields(input)` 驗證欄位範圍；移除 `calculateOrderTotal(orderItems)`
    - quantity: 1–9999, unitPrice/unitCost/shipping/discount: 0–999,999,999
    - discountAmount ≤ subtotalAmount + shippingAmount
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.7, 1.8_

  - [x] 2.3 新增 `shared/logic/order-number.ts`：實作 `generateOrderNumber()` 產生格式為 `ORD-YYYYMMDD-XXXX` 的唯一訂單編號
    - XXXX 為 4 碼隨機大寫英數字
    - _Requirements: 1.6_

  - [ ]\* 2.4 撰寫屬性測試 `shared/logic/__tests__/order-calculations.property.test.ts`
    - **Property 1: Order 欄位範圍驗證** — 驗證 validateOrderFields 對任意整數正確接受/拒絕
    - **Property 2: Order 金額計算正確性** — 驗證 totalPrice = quantity × unitPrice, totalCost null-safe, totalAmount = subtotal + shipping - discount
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.7, 1.8**

  - [ ]\* 2.5 撰寫屬性測試 `shared/logic/__tests__/order-status.property.test.ts`
    - **Property 4: Order 狀態機轉換完整性** — 驗證 isValidOrderStatusTransition 對所有狀態對正確回傳 true/false
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

  - [ ]\* 2.6 撰寫屬性測試 `shared/logic/__tests__/order-number.property.test.ts`
    - **Property 3: orderNumber 格式與唯一性** — 驗證產生的 orderNumber 符合 `/^ORD-\d{8}-[A-Z0-9]{4}$/` 且多次產生結果互不相同
    - **Validates: Requirements 1.6**

- [x] 3. 新增 Shared Logic — Shipment 狀態機與驗證
  - [x] 3.1 新增 `shared/logic/shipment-status.ts`：定義 Shipment 狀態轉換表、`isValidShipmentStatusTransition(from, to)`、`getNextAllowedShipmentStatuses(current)`
    - 允許轉換：PENDING→SHIPPED, PENDING→CANCELLED, SHIPPED→DELIVERED
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.8_

  - [x] 3.2 新增 `shared/logic/shipment-validation.ts`：實作 `validateOrdersForShipment(orders)` 驗證所有 Order 狀態為 RECEIVED；`validateShipmentInventory(orders, products)` 以 Product 層級彙總出貨數量並驗證庫存；`validateOrderNotInActiveShipment(order)` 驗證 Order 未關聯至未取消的 Shipment；`validateShipmentOrderCount(count)` 驗證 1–50 筆範圍
    - 錯誤訊息使用繁體中文
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 6.4, 6.5, 7.1, 7.2_

  - [ ]\* 3.3 撰寫屬性測試 `shared/logic/__tests__/shipment-status.property.test.ts`
    - **Property 6: Shipment 狀態機轉換完整性** — 驗證 isValidShipmentStatusTransition 對所有 ShipmentStatus 對正確回傳 true/false
    - **Validates: Requirements 5.2, 5.4, 5.6, 5.8**

  - [ ]\* 3.4 撰寫屬性測試 `shared/logic/__tests__/shipment-validation.property.test.ts`
    - **Property 7: Order 加入 Shipment 資格驗證** — 驗證僅 RECEIVED 狀態的 Order 可加入 Shipment
    - **Property 9: Order-Shipment 排他性關聯** — 驗證已關聯未取消 Shipment 的 Order 不可重複加入
    - **Property 10: Order 資料完整性於 Shipment 操作** — 驗證 Shipment 操作不改變 Order 其他欄位
    - **Property 11: 非 PENDING Shipment 禁止移除 Order** — 驗證僅 PENDING 狀態允許移除
    - **Property 12: Shipment 出貨庫存驗證** — 驗證以 productId 彙總數量後與庫存比對的正確性
    - **Property 13: Shipment 取消回補庫存** — 驗證出貨再取消的庫存淨變化為零
    - **Property 14: Shipment Order 數量邊界** — 驗證接受 1–50 筆，拒絕 0 或 >50 筆
    - **Validates: Requirements 4.4, 4.5, 4.6, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.4**

- [ ] 4. Checkpoint — 確認 shared 層邏輯正確
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 移除過時的 Shared Logic 檔案
  - [x] 5.1 刪除 `shared/logic/order-item-status.ts` 及其測試檔案；刪除 `shared/logic/order-merge.ts` 與 `shared/logic/order-split.ts` 及其測試檔案；確保 shared/logic 的 barrel export（若有 index.ts）移除對應 export
    - _Requirements: 2.1, 2.5_

- [x] 6. 重構 Amplify Data Schema
  - [x] 6.1 修改 `amplify/data/resource.ts`：在 Order model 中新增整合自 OrderItem 的欄位（productId、productNameSnapshot、productSkuSnapshot、productImageUrlSnapshot、selectedOptionsSnapshot、quantity、unitPriceSnapshot、unitCostSnapshot、totalPriceSnapshot、totalCostSnapshot、supplierName、purchasedAt、receivedAt、shippedAt、outOfStockAt、shipmentId）；新增 GSI（byStatus、byProductId、byShipmentId）；移除 `items: a.hasMany("OrderItem", "orderId")`
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 6.2 移除 `amplify/data/resource.ts` 中的 OrderItem model 定義、相關 enum 引用與 secondaryIndexes
    - _Requirements: 2.1_

  - [x] 6.3 在 `amplify/data/resource.ts` 中新增 Shipment model 定義，包含所有欄位（shipmentNumber、recipientName、recipientPhone、recipientAddress、status、shippingMethod、trackingNumber、actualShippingCost、shippedAt、deliveredAt、cancelledAt、note、gsiPartition、createdAtForSort）與 GSI（byShipmentNumber、byCreatedAt、byStatus）
    - _Requirements: 4.1, 4.2, 8.1, 8.2, 8.3_

  - [x] 6.4 在 `amplify/data/resource.ts` 中新增 ShipmentStatus enum；移除 mergeOrders/splitOrder custom mutations；重構現有 custom mutations（confirmPurchase、cancelPurchase、confirmReceived、cancelReceived、confirmShipment、cancelShipment、confirmOutOfStock、cancelOutOfStock）改為接受 orderId 參數；新增 Shipment custom mutations（createShipment、confirmShipmentDispatch、confirmShipmentDelivery、cancelShipmentOrder、addOrderToShipment、removeOrderFromShipment）
    - _Requirements: 2.5, 4.1, 5.2, 5.4, 5.6, 6.3, 6.6_

- [x] 7. 重構 Order Lambda Handlers
  - [x] 7.1 重構 `amplify/functions/confirm-purchase/handler.ts`：改為接受 `orderId` 參數，直接操作 Order 的 status 欄位從 PENDING→ORDERED，記錄 purchasedAt 與 supplierName，附加 statusHistory 記錄
    - 使用 shared/logic/order-status.ts 驗證轉換合法性
    - _Requirements: 2.5, 3.2, 3.9_

  - [x] 7.2 重構 `amplify/functions/cancel-purchase/handler.ts`：改為接受 `orderId`，操作 Order 的 status 欄位從 ORDERED 回退處理
    - _Requirements: 2.5, 3.8_

  - [x] 7.3 重構 `amplify/functions/confirm-received/handler.ts`：改為接受 `orderId`，操作 Order status 從 ORDERED→RECEIVED，記錄 receivedAt
    - _Requirements: 2.5, 3.3, 3.9_

  - [x] 7.4 重構 `amplify/functions/cancel-received/handler.ts`：改為接受 `orderId`，操作 Order status 回退處理
    - _Requirements: 2.5, 3.8_

  - [x] 7.5 重構 `amplify/functions/confirm-shipment/handler.ts`：改為接受 `orderId`，操作 Order status 從 RECEIVED→SHIPPED，記錄 shippedAt（單筆直接出貨情境）
    - _Requirements: 2.5, 3.4, 3.9_

  - [x] 7.6 重構 `amplify/functions/cancel-shipment/handler.ts`：改為接受 `orderId`，操作 Order status 回退處理
    - _Requirements: 2.5, 3.8_

  - [x] 7.7 重構 `amplify/functions/confirm-out-of-stock/handler.ts`：改為接受 `orderId`，操作 Order status 從 PENDING/ORDERED→OUT_OF_STOCK，記錄 outOfStockAt
    - _Requirements: 2.5, 3.6, 3.9_

  - [x] 7.8 重構 `amplify/functions/cancel-out-of-stock/handler.ts`：改為接受 `orderId`，操作 Order status 回退處理
    - _Requirements: 2.5, 3.8_

- [x] 8. 新增 Shipment Lambda Handlers
  - [x] 8.1 新增 `amplify/functions/create-shipment/handler.ts`：驗證 Orders 狀態皆為 RECEIVED、驗證無重複關聯、驗證數量 1–50、建立 Shipment（透過 SequenceCounter 產生 shipmentNumber）、設定各 Order 的 shipmentId
    - 使用 shared/logic/shipment-validation.ts 驗證邏輯
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 6.3, 6.4, 6.5_

  - [x] 8.2 新增 `amplify/functions/confirm-shipment-dispatch/handler.ts`：在單一 DynamoDB TransactWriteItems 中完成庫存驗證→庫存扣減→Shipment 狀態更新為 SHIPPED→所有關聯 Order 狀態更新為 SHIPPED（含 shippedAt），處理 TransactionCanceledException
    - 使用 shared/logic/shipment-validation.ts 驗證庫存
    - 使用 shared/logic/shipment-status.ts 驗證狀態轉換
    - _Requirements: 5.2, 5.3, 5.9, 7.1, 7.2, 7.3, 7.5_

  - [x] 8.3 新增 `amplify/functions/confirm-shipment-delivery/handler.ts`：將 Shipment 狀態從 SHIPPED→DELIVERED，同時將所有關聯 Order 狀態更新為 COMPLETED（含 completedAt、deliveredAt）
    - _Requirements: 5.4, 5.5_

  - [x] 8.4 新增 `amplify/functions/cancel-shipment-order/handler.ts`：將 PENDING 狀態的 Shipment 轉為 CANCELLED，回退 Orders 狀態為 RECEIVED 並清除 shipmentId；若 Shipment 為 SHIPPED 狀態則額外回補庫存
    - _Requirements: 5.6, 5.7, 5.9, 7.4_

  - [x] 8.5 新增 `amplify/functions/add-order-to-shipment/handler.ts`：驗證 Order 狀態為 RECEIVED、未關聯其他未取消 Shipment、Shipment 為 PENDING 且未超過 50 筆，然後設定 Order.shipmentId
    - _Requirements: 4.4, 4.5, 4.6, 6.3, 6.4, 6.5_

  - [x] 8.6 新增 `amplify/functions/remove-order-from-shipment/handler.ts`：驗證 Shipment 狀態為 PENDING，然後清除 Order.shipmentId
    - _Requirements: 6.6, 6.7_

- [ ] 9. Checkpoint — 確認 schema 與 Lambda handlers 正確
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. 移除過時的 Lambda Handlers
  - [ ] 10.1 刪除 `amplify/functions/merge-orders/` 與 `amplify/functions/split-order/` 目錄；從 `amplify/backend.ts` 移除對應的 function 註冊
    - _Requirements: 2.5_

- [ ] 11. 註冊新 Lambda Functions
  - [ ] 11.1 在 `amplify/backend.ts` 中註冊所有新增的 Shipment Lambda functions（create-shipment、confirm-shipment-dispatch、confirm-shipment-delivery、cancel-shipment-order、add-order-to-shipment、remove-order-from-shipment），確保環境變數與 IAM 權限正確設定（DynamoDB 表存取）
    - _Requirements: 4.1, 5.2, 5.4, 5.6_

- [ ] 12. 撰寫 Lambda Handler 整合測試
  - [ ]\* 12.1 撰寫 `amplify/functions/confirm-shipment-dispatch/__tests__/handler.test.ts`：使用 mock DynamoDB client 測試出貨交易原子性、庫存不足拒絕、TransactionCanceledException 處理
    - **Property 8: Shipment-Order 狀態同步** — 驗證出貨後所有 Order 狀態為 SHIPPED
    - **Property 12: Shipment 出貨庫存驗證** — 驗證庫存不足時拒絕出貨
    - **Validates: Requirements 5.2, 5.3, 5.9, 7.1, 7.2, 7.3, 7.5**

  - [ ]\* 12.2 撰寫 `amplify/functions/cancel-shipment-order/__tests__/handler.test.ts`：測試取消出貨單回退 Order 狀態與庫存回補
    - **Property 13: Shipment 取消回補庫存** — 驗證出貨再取消的庫存淨變化為零
    - **Validates: Requirements 5.6, 5.7, 7.4**

  - [ ]\* 12.3 撰寫 `amplify/functions/create-shipment/__tests__/handler.test.ts`：測試建立出貨單的驗證邏輯（Order 狀態檢查、排他性關聯、數量邊界）
    - **Property 14: Shipment Order 數量邊界** — 驗證 1–50 筆範圍
    - **Property 15: shipmentNumber 嚴格遞增** — 驗證 SequenceCounter 遞增行為
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

- [ ] 13. 更新 Demo Scripts
  - [ ] 13.1 重構 `scripts/seed-demo-data.mjs`：移除 OrderItem 產生邏輯；改為直接建立扁平 Order（含商品快照、金額、狀態欄位）；新增 Shipment 假資料產生（含 PENDING/SHIPPED/DELIVERED/CANCELLED 各狀態）；確保 Shipment 關聯 Order 的 shipmentId 正確設定；確保 SHIPPED Shipment 下 Order status=SHIPPED 且有 shippedAt，DELIVERED Shipment 下 Order status=COMPLETED 且有 completedAt；更新摘要 JSON 輸出（新增 shipments，移除 orderItems）
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 10.8_

  - [ ] 13.2 重構 `scripts/clear-demo-data.mjs`：新增 Shipment 資料表清除；移除 OrderItem 資料表清除操作
    - _Requirements: 10.6_

  - [ ] 13.3 更新 `scripts/seed-demo-data.mjs` 中的 `validateSeedConsistency` 函式：驗證新 Order 模型欄位完整性（商品快照、金額計算、狀態一致性）與 Shipment-Order 關聯正確性；移除 OrderItem 相關驗證
    - _Requirements: 10.5_

  - [ ] 13.4 重構 `scripts/rebuild-product-order-summaries.mjs`：改為掃描 Order 資料表，依 productId/status/quantity 重新聚合 ProductOrderSummary；移除 orderItem 引用
    - _Requirements: 10.9_

  - [ ] 13.5 重構 `scripts/rebuild-supplier-order-summaries.mjs`：改為掃描 Order 資料表，依 supplierName/status/quantity 重新聚合 SupplierOrderSummary；移除 orderItem 引用
    - _Requirements: 10.10_

  - [ ] 13.6 重構 `scripts/rebuild-customer-order-summaries.mjs`：改為僅掃描 Order 資料表，直接從 Order 取得商品與金額資訊聚合 CustomerOrderSummary；移除 orderItem 引用
    - _Requirements: 10.11_

  - [ ] 13.7 更新各 rebuild summary 腳本中的 `validateSummaryConsistency` 函式：改為依據 Order 資料驗證摘要聚合結果
    - _Requirements: 10.12_

- [ ] 14. 最終 Checkpoint — 全面驗證
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (Properties 1–15)
- Unit tests validate specific examples and edge cases
- 所有錯誤訊息使用繁體中文
- shared/logic/ 中的純函式可供前端與 Lambda 共用，避免重複實作
- Lambda handlers 負責 DynamoDB 存取與交易控制，業務規則委派給 shared/logic/

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "3.1", "3.2"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.6", "3.3", "3.4", "5.1"] },
    { "id": 3, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["6.4"] },
    {
      "id": 5,
      "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8"]
    },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "10.1"] },
    { "id": 7, "tasks": ["11.1"] },
    { "id": 8, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 9, "tasks": ["13.1", "13.2", "13.4", "13.5", "13.6"] },
    { "id": 10, "tasks": ["13.3", "13.7"] }
  ]
}
```
