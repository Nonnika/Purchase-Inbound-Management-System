import { apiClient } from './client'
import type { PageParams, Paginated } from '@/types/pagination'
import type { AffectedResult } from '@/types/user'
import type { CreatedResult } from '@/types/department'
import type { Item, ItemInput, ItemUpdate } from '@/types/item'

/**
 * Item API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/itemController.go RegisterAuthRouter).
 * Reads need a valid JWT; `create` is purchaser/admin-gated;
 * `update`/`delete` are manager-gated (admin/warehouse/auditor).
 *
 *   POST   /api/items/selectAll  (body {page, page_size} -> {list, total})
 *   GET    /api/items/selectById?id=   -> Item   (400 id / 404)
 *   POST   /api/items/create  (purchaser/admin) -> { id }       (JSON: ItemInput)
 *   POST   /api/items/update?id=  (manager)     -> { affected } (JSON: ItemUpdate, partial)
 *   DELETE /api/items/delete?id= (manager)      -> { affected }
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure.
 */
export const itemsApi = {
  /** Paginated item list. POST `{ page, page_size }` -> `{ list, total }` (id desc). */
  selectAll(params: PageParams = {}): Promise<Paginated<Item>> {
    return apiClient
      .post<Paginated<Item>>('/items/selectAll', params)
      .then((res) => res.data)
  },

  selectById(id: number): Promise<Item> {
    return apiClient.get<Item>('/items/selectById', { params: { id } }).then((res) => res.data)
  },

  create(payload: ItemInput): Promise<CreatedResult> {
    return apiClient.post<CreatedResult>('/items/create', payload).then((res) => res.data)
  },

  /** POST /items/update?id= (manager) -> { affected }. Send only changed fields. */
  update(id: number, payload: ItemUpdate): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/items/update', payload, { params: { id } })
      .then((res) => res.data)
  },

  /** DELETE /items/delete?id= (manager) -> { affected }. */
  delete(id: number): Promise<AffectedResult> {
    return apiClient
      .delete<AffectedResult>('/items/delete', { params: { id } })
      .then((res) => res.data)
  },
}
