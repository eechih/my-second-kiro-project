# 任務清單：LineItem 採購簡化（狀態標籤化）

## 任務 1：更新資料模型與型別定義

- [ ] 1.1 更新 `shared/models/order.ts`：移除 `PurchaseRecord` 介面、`PurchaseRecordStatus` 型別、`CreatePurchaseRecordInput` 介面
- [ ] 1.2 更新 `shared/models/order.ts`：在 `LineItem` 介面新增 `supplierId: string | null`、`supplierName: string | null`、`unitCost: number | null` 欄位
- [ ] 1.3 更新 `shared/models/order.ts`：將 `LineItem` 介面中的 `orderedAt` 改為 `purchasedAt`
- [ ] 1.4 更新 `shared/models/order.ts`：從 `LineItem` 介面移除 `purchaseRecords: PurchaseRecord[]` 欄位

## 任務 2：更新 Amplify Data Schema

- [ ] 2.1 更新 `amplify/data/resource.ts`：在 LineItem 模型新增 `supplierId`、`supplierName`、`unitCost` 欄位
- [ ] 2.2 更新 `amplify/data/resource.ts`：將 LineItem 模型的 `orderedAt` 改為 `purchasedAt`
- [ ] 2.3 更新 `amplify/data/resource.ts`：從 LineItem 模型移除 `purchaseRecords` hasMany 關聯
- [ ] 2.4 更新 `amplify/data/resource.ts`：移除 PurchaseRecord 模型定義
- [ ] 2.5 更新 `amplify/data/resource.ts`：修改 `confirmReceived` mutation 參數為 `lineItemId`、`orderId`、`orderSortKey`

## 任務 3：建立採購驗證邏輯模組

- [ ] 3.1 建立 `shared/logic/procurement.ts`：實作 `validateProcurementOrder` 函式（驗證 status === "待處理"、supplierId 非空、unitCost >= 0）
- [ ] 3.2 建立 `shared/logic/procurement.ts`：實作 `validateProcurementReceive` 函式（驗證 status === "已訂購"、purchasedQuantity > 0）
- [ ] 3.3 建立 `shared/logic/procurement.ts`：實作 `validateProcurementCancel` 函式（驗證 status 為「待處理」或「已訂購」）
- [ ] 3.4 建立 `shared/logic/procurement.ts`：實作 `calculateProcurementCost` 函式（purchasedQuantity × unitCost）
- [ ] 3.5 建立 `shared/logic/__tests__/procurement.property.test.ts`：撰寫屬性測試（採購成本非負、驗證一致性、取消驗證一致性）

## 任務 4：移除 PurchaseRecord 相關邏輯

- [ ] 4.1 刪除 `shared/logic/purchase-record.ts`
- [ ] 4.2 刪除 `shared/logic/__tests__/purchase-record.property.test.ts`
- [ ] 4.3 更新所有引用 `purchase-record.ts` 的檔案，移除相關 import 與使用

## 任務 5：更新 confirmReceived Lambda

- [ ] 5.1 重寫 `amplify/functions/confirm-received/handler.ts`：移除 PurchaseRecord 表查詢邏輯
- [ ] 5.2 重寫 `amplify/functions/confirm-received/handler.ts`：直接從 LineItem 讀取 `status` 與 `purchasedQuantity`
- [ ] 5.3 重寫 `amplify/functions/confirm-received/handler.ts`：TransactWriteItems 只包含 LineItem 更新（status → "已收到"、receivedAt）與庫存更新
- [ ] 5.4 更新 `amplify/functions/confirm-received/resource.ts`：移除 PurchaseRecord 表的環境變數設定
- [ ] 5.5 更新 `amplify/functions/confirm-received/handler.ts`：mutation 參數改為 `lineItemId`、`orderId`、`orderSortKey`

## 任務 6：更新相關程式碼中的 orderedAt 引用

- [ ] 6.1 全域搜尋並更新所有 `orderedAt` 引用為 `purchasedAt`（包含 Lambda handlers、hooks、UI 元件）
- [ ] 6.2 更新 `amplify/functions/ship-line-item/handler.ts` 中的相關引用（若有）
- [ ] 6.3 更新前端 hooks（`src/hooks/useOrders.ts`）中的相關引用

## 任務 7：更新前端 UI 元件

- [ ] 7.1 更新訂單明細列表元件：新增 `supplierName` 與 `unitCost` 欄位顯示
- [ ] 7.2 新增「標記採購」操作按鈕（僅在 status === "待處理" 時顯示）
- [ ] 7.3 新增「標記採購」對話框元件：包含供應商選擇（EntitySelect）與單位成本輸入欄位
- [ ] 7.4 更新「確認入庫」操作按鈕邏輯：改為直接呼叫簡化版 confirmReceived mutation
- [ ] 7.5 新增「取消採購」操作按鈕（僅在 status === "已訂購" 時顯示）
- [ ] 7.6 移除前端所有 PurchaseRecord 相關的查詢、型別引用與 UI 元件

## 任務 8：更新前端 Hooks

- [ ] 8.1 更新 `src/hooks/useOrders.ts`：移除 PurchaseRecord 相關的查詢與 mutation
- [ ] 8.2 更新 `src/hooks/useOrders.ts`：新增採購下單 mutation（updateLineItem 設定 status、supplierId、supplierName、unitCost、purchasedQuantity、purchasedAt）
- [ ] 8.3 更新 `src/hooks/useOrders.ts`：新增採購取消 mutation（updateLineItem 設定 status → "缺貨"、purchasedQuantity → 0）
- [ ] 8.4 更新 `src/hooks/useOrders.ts`：更新 confirmReceived mutation 呼叫參數

## 任務 9：更新既有測試

- [ ] 9.1 更新 `shared/logic/__tests__/order-status.property.test.ts`：確認不受 PurchaseRecord 移除影響
- [ ] 9.2 確認 `shared/logic/line-item-status.ts` 的既有轉換邏輯不需變更（待處理 → 已訂購 → 已收到 路徑已存在）
- [ ] 9.3 執行全部測試確認無破壞性變更

## 任務 10：資料遷移腳本（選擇性）

- [ ] 10.1 建立遷移腳本：讀取所有 PurchaseRecord，將 supplierId、supplierName、unitCost 回填至對應 LineItem
- [ ] 10.2 遷移腳本處理無 PurchaseRecord 的 LineItem（新增欄位保持 null）
- [ ] 10.3 遷移腳本為冪等操作（重複執行不產生錯誤）
