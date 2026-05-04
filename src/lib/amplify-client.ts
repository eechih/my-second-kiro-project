import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

/**
 * 型別安全的 Amplify Data client
 *
 * 使用 Amplify Gen2 的 `generateClient<Schema>()` 產生，
 * 自動推導所有模型的 CRUD 操作與 custom mutation 的型別。
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
export const client = generateClient<Schema>();

export type { Schema };
