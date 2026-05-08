# 需求文件：LineItem 採購簡化（狀態標籤化）

## 需求 1：移除 PurchaseRecord 模型

### 使用者故事
身為系統開發者，我希望移除獨立的 PurchaseRecord 資料模型，以簡化資料架構並降低跨表交易的複雜度。

### 驗收條件
- 1.1 從 Amplify Gen2 schema（`amplify/data/resource.ts`）中移除 PurchaseRecord 模型定義
- 1.2 從 LineItem 模型中移除 `purchaseRecords` hasMany 關聯
- 1.3 從 `shared/models/order.ts` 中移除 `PurchaseRecord` 介面、`PurchaseRecordStatus` 型別、`CreatePurchaseRecordInput` 介面
- 1.4 移除 `shared/logic/purchase-record.ts` 模組及其對應的測試檔案
- 1.5 移除 `confirmReceived` mutation 中的 `purchaseRecordId` 與 `purchaseRecordSortKey` 參數

---

## 需求 2：擴充 LineItem 模型新增採購數據欄位

### 使用者故事
身為系統使用者，我希望在明細項目中直接看到供應商與採購成本資訊，不需要額外查詢採購記錄。

### 驗收條件
- 2.1 LineItem 模型新增 `supplierId`（選填字串）欄位，記錄供應商 ID
- 2.2 LineItem 模型新增 `supplierName`（選填字串）欄位，記錄供應商名稱（反正規化）
- 2.3 LineItem 模型新增 `unitCost`（選填浮點數）欄位，記錄採購單位成本
- 2.4 LineItem 模型將既有的 `orderedAt` 欄位重新命名為 `purchasedAt`
- 2.5 `shared/models/order.ts` 中的 `LineItem` 介面同步更新，新增 `supplierId: string | null`、`supplierName: string | null`、`unitCost: number | null` 欄位
- 2.6 `shared/models/order.ts` 中的 `LineItem` 介面將 `orderedAt` 改為 `purchasedAt`

---

## 需求 3：採購下單操作

### 使用者故事
身為訂單管理人員，我希望能對「待處理」狀態的明細項目標記採購（選擇供應商、填入單位成本），使其狀態自動轉為「已訂購」。

### 驗收條件
- 3.1 僅當 `status === "待處理"` 時可執行採購下單操作
- 3.2 採購下單時必須選擇供應商（`supplierId` 非空）
- 3.3 採購下單時必須填入單位成本（`unitCost >= 0`）
- 3.4 採購下單後 `status` 自動轉為「已訂購」
- 3.5 採購下單後 `purchasedQuantity` 設為 `quantity`（全量採購）
- 3.6 採購下單後 `purchasedAt` 記錄當前時間
- 3.7 採購下單後 `supplierId`、`supplierName`、`unitCost` 欄位被正確填入
- 3.8 提供 `validateProcurementOrder` 純函式驗證前置條件，前端與後端共用

---

## 需求 4：入庫確認操作（簡化版）

### 使用者故事
身為倉庫管理人員，我希望對「已訂購」狀態的明細項目確認入庫，使庫存自動增加且狀態轉為「已收到」。

### 驗收條件
- 4.1 僅當 `status === "已訂購"` 時可執行入庫確認操作
- 4.2 入庫確認後 `status` 自動轉為「已收到」
- 4.3 入庫確認後 `receivedAt` 記錄當前時間
- 4.4 入庫確認後對應的 ProductVariant（或 Product）的 `stockQuantity` 增加 `purchasedQuantity`
- 4.5 庫存更新使用樂觀併發控制（version ConditionExpression），版本不一致時交易失敗並回傳錯誤訊息
- 4.6 `confirmReceived` Lambda 使用 DynamoDB TransactWriteItems 確保原子性（LineItem 更新 + 庫存更新在同一交易中）
- 4.7 `confirmReceived` mutation 參數簡化為 `lineItemId`、`orderId`、`orderSortKey`
- 4.8 提供 `validateProcurementReceive` 純函式驗證前置條件，前端與後端共用

---

## 需求 5：採購取消操作

### 使用者故事
身為訂單管理人員，我希望能取消「待處理」或「已訂購」狀態的明細項目的採購，使其狀態轉為「缺貨」。

### 驗收條件
- 5.1 僅當 `status === "待處理"` 或 `status === "已訂購"` 時可執行取消操作
- 5.2 「已收到」或「已出貨」狀態的明細項目不可取消採購
- 5.3 取消後 `status` 轉為「缺貨」
- 5.4 取消後 `purchasedQuantity` 歸零
- 5.5 提供 `validateProcurementCancel` 純函式驗證前置條件，前端與後端共用

---

## 需求 6：採購成本計算

### 使用者故事
身為訂單管理人員，我希望能看到每筆明細項目的採購總成本（數量 × 單位成本），以便掌握進貨成本。

### 驗收條件
- 6.1 提供 `calculateProcurementCost(purchasedQuantity, unitCost)` 純函式計算採購總成本
- 6.2 計算結果為 `purchasedQuantity × unitCost`
- 6.3 當 `unitCost` 為 null（尚未採購）時，前端顯示「—」或不顯示成本
- 6.4 計算結果必須 >= 0（前置條件：purchasedQuantity >= 0 且 unitCost >= 0）

---

## 需求 7：更新 confirmReceived Lambda

### 使用者故事
身為系統開發者，我希望簡化 `confirmReceived` Lambda 函式，使其不再查詢 PurchaseRecord 表，直接操作 LineItem 完成入庫確認。

### 驗收條件
- 7.1 Lambda 不再讀取或寫入 PurchaseRecord 表
- 7.2 Lambda 直接從 LineItem 讀取 `status` 判斷是否可入庫（必須為「已訂購」）
- 7.3 Lambda 直接從 LineItem 讀取 `purchasedQuantity` 作為庫存增加量
- 7.4 Lambda 使用 TransactWriteItems 在同一交易中更新 LineItem（status → "已收到"、receivedAt）與庫存（stockQuantity += purchasedQuantity、version += 1）
- 7.5 Lambda 移除 `PURCHASERECORD_TABLE_NAME` 環境變數依賴
- 7.6 Lambda 的 `confirmReceived` mutation 參數改為 `lineItemId`、`orderId`、`orderSortKey`

---

## 需求 8：更新前端 UI

### 使用者故事
身為訂單管理人員，我希望在訂單明細列表中直接看到採購狀態、供應商與成本資訊，並能執行採購相關操作。

### 驗收條件
- 8.1 訂單明細列表顯示 `supplierName` 欄位（未採購時顯示「—」）
- 8.2 訂單明細列表顯示 `unitCost` 欄位（未採購時顯示「—」）
- 8.3 「待處理」狀態的明細項目顯示「標記採購」操作按鈕
- 8.4 「已訂購」狀態的明細項目顯示「確認入庫」與「取消採購」操作按鈕
- 8.5 「標記採購」操作彈出對話框，包含供應商選擇（EntitySelect）與單位成本輸入
- 8.6 移除前端所有 PurchaseRecord 相關的查詢、型別引用與 UI 元件
- 8.7 所有 UI 文字使用繁體中文

---

## 需求 9：資料遷移

### 使用者故事
身為系統管理者，我希望現有的採購記錄資料能正確遷移至 LineItem 欄位中，確保歷史資料不遺失。

### 驗收條件
- 9.1 提供遷移腳本，將 PurchaseRecord 的 `supplierId`、`supplierName`、`unitCost` 回填至對應的 LineItem
- 9.2 無 PurchaseRecord 的 LineItem，新增欄位保持 null
- 9.3 遷移後 LineItem 的 `status` 與原有狀態一致（不因遷移而改變）
- 9.4 遷移腳本為冪等操作（重複執行不會產生錯誤或重複資料）
