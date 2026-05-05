import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

/**
 * 型別安全的 Amplify Data client（延遲初始化）
 *
 * 使用 Amplify Gen2 的 `generateClient<Schema>()` 產生，
 * 自動推導所有模型的 CRUD 操作與 custom mutation 的型別。
 *
 * 採用 lazy initialization 模式，確保 `Amplify.configure()` 已在 `main.tsx`
 * 中執行完畢後才呼叫 `generateClient()`，避免模組載入順序導致的初始化錯誤。
 *
 * 用法：
 * ```ts
 * import { client } from "@/lib/amplify-client";
 *
 * // 標準 CRUD
 * const { data } = await client.models.Customer.list();
 *
 * // Custom Mutation
 * const result = await client.mutations.shipLineItem({ ... });
 * ```
 */

let _client: ReturnType<typeof generateClient<Schema>> | null = null;

function getClient(): ReturnType<typeof generateClient<Schema>> {
  if (!_client) {
    _client = generateClient<Schema>();
  }
  return _client;
}

/**
 * Proxy-based lazy client：存取任何屬性時才觸發 generateClient()。
 * 對外使用方式與直接匯出的 client 完全相同。
 */
export const client = new Proxy(
  {} as ReturnType<typeof generateClient<Schema>>,
  {
    get(_target, prop, receiver) {
      const realClient = getClient();
      const value = Reflect.get(realClient, prop, receiver);
      return value;
    },
  },
);

export type { Schema };
