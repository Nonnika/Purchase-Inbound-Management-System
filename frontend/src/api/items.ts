import { apiClient } from './client'
import type { CreatedResult } from '@/types/department'
import type { Item, ItemInput } from '@/types/item'

/**
 * Item API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/itemController.go RegisterAuthRouter).
 * Reads need a valid JWT; `create` is purchaser/admin-gated. The backend
 * exposes no update/delete for items, so the surface is read + create only.
 *
 *   GET  /api/items/selectAll        -> Item[]
 *   GET  /api/items/selectById?id=   -> Item   (400 id / 404)
 *   POST /api/items/create  (purchaser/admin) -> { id }  (JSON: ItemInput)
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure.
 */
export const itemsApi = {
  selectAll(): Promise<Item[]> {
    return apiClient.get<Item[]>('/items/selectAll').then((res) => res.data)
  },

  selectById(id: number): Promise<Item> {
    return apiClient.get<Item>('/items/selectById', { params: { id } }).then((res) => res.data)
  },

  create(payload: ItemInput): Promise<CreatedResult> {
    return apiClient.post<CreatedResult>('/items/create', payload).then((res) => res.data)
  },
}
