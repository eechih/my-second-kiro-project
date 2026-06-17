# Seed Demo Data

這份文件說明如何使用 [seed-demo-data.mjs](/Volumes/External SSD/code/my-second-kiro-project/scripts/seed-demo-data.mjs) 建立測試用的 `Customer`、`Supplier`、`Product`、`Order`、`OrderItem` 與 `CustomerOrderSummary` 假資料。

如果需要清空資料或重建摘要，也可以搭配 [clear-demo-data.mjs](/Volumes/External SSD/code/my-second-kiro-project/scripts/clear-demo-data.mjs) 與 [rebuild-customer-order-summaries.mjs](/Volumes/External SSD/code/my-second-kiro-project/scripts/rebuild-customer-order-summaries.mjs) 使用。

## 用途

適合拿來：

- 測試客戶/商品搜尋
- 驗證訂單列表與明細畫面
- 準備 demo 環境
- 壓測「常用客戶」與「商品選單」查詢體驗

## 預設建立數量

如果不帶參數，會建立：

- 32 筆 `Customer`
- 8 筆 `Supplier`
- 64 筆 `Product`
- 96 筆 `Order`

## 指令

使用 `npm script`：

```bash
npm run seed:demo
```

在執行前，請先在專案根目錄建立本機 marker 檔案：

```bash
touch .demo-scripts.local
```

沒有這個檔案時，`seed-demo-data` 與 `clear-demo-data` 都會拒絕執行。

直接執行腳本：

```bash
node scripts/seed-demo-data.mjs
```

## 自訂數量

可以透過參數指定建立數量：

```bash
node scripts/seed-demo-data.mjs --customers 200 --products 200 --orders 500
```

等價的 `npm` 版本：

```bash
npm run seed:demo -- --customers 200 --products 200 --orders 500
```

供應商不提供數量參數，會固定產生全部 `translationParser` 對應的供應商：

- 供應商假資料不可重複
- 每筆供應商都會綁定唯一的 `translationParser`
- 目前固定建立 `8` 筆

## Dry Run

如果只想先看腳本是否能正常組資料、不實際寫入 DynamoDB，可以用：

```bash
node scripts/seed-demo-data.mjs --dry-run
```

## 資料內容

腳本會建立：

- 啟用中的 `Customer`
- 啟用中的 `Supplier`
- 啟用中的 `Product`
- 多種 `PaymentStatus` 狀態的 `Order`
- 對應的 `OrderItem`
- 客戶出貨列表用的 `CustomerOrderSummary`

並且會一起維護：

- `Customer.orderCount`
- `Customer.orderCountForSort`
- `Customer.lastOrderedAt`
- `Customer.lastOrderedAtForSort`
- `Supplier.translationParser`
- `Product.sequenceNumber`
- `Product.sku`
- `Product.defaultSupplierId`
- `CustomerOrderSummary.pendingOrderCount`
- `CustomerOrderSummary.pendingItemCount`
- `CustomerOrderSummary.readyToShipOrderCount`
- `CustomerOrderSummary.readyToShipItemCount`
- `CustomerOrderSummary.latestReadyToShipReceivedAt`
- `CustomerOrderSummary.shippedOrderCount`
- `CustomerOrderSummary.shippedItemCount`
- `CustomerOrderSummary.completedOrderCount`
- `CustomerOrderSummary.totalOrderCount`
- `SequenceCounter` 的 `ProductSku` 流水號

## 假資料特性

- 客戶會偏重集中在一部分常用客戶上，方便測試「最常下單客戶」排序
- 供應商會帶入對應的 `translationParser`，例如 `wish`、`boom`、`apple`
- 供應商名稱與 `translationParser` 都不重複
- 商品會自動產生 `SKU-000001` 這種格式的流水號
- 商品會輪流指派到已建立的供應商
- 商品規格最多 3 組，約 7 成商品不帶規格
- 有規格的商品會同步建立 `ProductOption` / `ProductOptionValue`
- 訂單會帶客戶與商品快照欄位，符合目前 schema
- 訂單明細會帶對應的 `selectedOptionsSnapshot`
- 每張訂單會有 1 到 10 筆明細，約 7 成訂單只有 1 筆

## 注意事項

- 這支腳本是直接寫 AWS DynamoDB，不是只改本機 mock data
- 重複執行會再新增一批資料，不會自動清除舊資料
- 大量寫入前，建議先在 sandbox 或測試環境執行
- 如果環境無法連到 AWS，會出現類似 `getaddrinfo ENOTFOUND dynamodb...` 的錯誤
- Demo scripts 只允許在本機環境執行；CI 環境會直接被拒絕

## 清除全部資料

如果你要把目前環境的主要業務資料全部清掉，可以使用：

```bash
npm run clear:demo -- --confirm DELETE_ALL_DATA
```

這會清除：

- `Customer`
- `Supplier`
- `Product`
- `ProductOption`
- `ProductOptionValue`
- `Order`
- `OrderItem`
- `CustomerOrderSummary`
- `SequenceCounter`

先看預計刪除數量、不實際刪除：

```bash
node scripts/clear-demo-data.mjs --dry-run
```

注意：

- 這是破壞性操作
- 沒有內建復原機制
- 建議只在 sandbox 或測試環境執行

## 只清除客戶出貨摘要

如果只是 `CustomerOrderSummary` 資料壞掉，想保留既有訂單與商品資料，可以只清摘要表：

```bash
npm run clear:customer-order-summary -- --confirm DELETE_ALL_DATA
```

先看預計刪除數量：

```bash
node scripts/clear-demo-data.mjs --only summary-only --dry-run
```

## 依現有訂單重建客戶出貨摘要

如果你已經保留 `Order` / `OrderItem`，想直接把摘要重建回來，可以使用：

```bash
npm run rebuild:customer-order-summary -- --confirm REBUILD_SUMMARIES
```

先做 dry run：

```bash
node scripts/rebuild-customer-order-summaries.mjs --dry-run
```

這支腳本會：

- 掃描現有 `Order`
- 掃描現有 `OrderItem`
- 清空 `CustomerOrderSummary`
- 依目前訂單狀態重新寫回摘要

## 建議流程

1. 先 dry run

```bash
node scripts/seed-demo-data.mjs --dry-run
```

2. 再建立正式假資料

```bash
npm run seed:demo -- --customers 200 --products 200 --orders 500
```

3. 建立完成後，檢查：

- 客戶列表
- 商品列表
- 新增訂單頁的客戶/商品選單
- 訂單列表與訂單明細

## 常用範例

小量 smoke test：

```bash
npm run seed:demo -- --customers 5 --products 5 --orders 10
```

中量 demo：

```bash
npm run seed:demo -- --customers 50 --products 50 --orders 100
```

你目前要的版本：

```bash
npm run seed:demo -- --customers 200 --products 200 --orders 500
```
