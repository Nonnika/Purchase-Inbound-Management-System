import { apiClient } from './client'
import type { PageParams, Paginated } from '@/types/pagination'
import type { AffectedResult } from '@/types/user'
import type { CreatedResult } from '@/types/department'
import type { ItemCategory, ItemCategoryInput } from '@/types/itemCategory'

/**
 * Item-category API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/itemCategoriesController.go
 * RegisterAuthRouter). Categories form a tree via the nullable `parent`
 * field (null/0 = root), like departments.
 *
 * All routes live on the `auth` group, so every call requires a valid JWT.
 * Write routes are admin-gated on the backend.
 *
 *   POST   /api/itemCategories/register        (admin) -> { id }       (JSON: ItemCategoryInput)
 *   POST   /api/itemCategories/selectAll       (body {page, page_size} -> {list, total})
 *   GET    /api/itemCategories/selectById?id=           -> ItemCategory   (400 id / 404)
 *   GET    /api/itemCategories/selectByName?name=       -> ItemCategory   (400 name / 404)
 *   DELETE /api/itemCategories/deleteById?id=  (admin)  -> { affected }
 *   POST   /api/itemCategories/UpdateNameById?id=       -> { affected } (JSON: { name })
 *   POST   /api/itemCategories/UpdateDescriptionById?id=-> { affected } (JSON: { description })
 *   POST   /api/itemCategories/UpdateParentById?id=     -> { affected } (JSON: { parent })
 *
 * The Update* handlers use Gin ShouldBind (JSON or form); we send JSON for
 * consistency. Nullable fields (`description`, `parent`) are sent as JSON
 * `null` (backend normalizes nil/0 → nil).
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure.
 */
export const itemCategoriesApi = {
  /** Paginated category list. POST `{ page, page_size }` -> `{ list, total }` (id desc). */
  selectAll(params: PageParams = {}): Promise<Paginated<ItemCategory>> {
    return apiClient
      .post<Paginated<ItemCategory>>('/itemCategories/selectAll', params)
      .then((res) => res.data)
  },

  selectById(id: number): Promise<ItemCategory> {
    return apiClient
      .get<ItemCategory>('/itemCategories/selectById', { params: { id } })
      .then((res) => res.data)
  },

  selectByName(name: string): Promise<ItemCategory> {
    return apiClient
      .get<ItemCategory>('/itemCategories/selectByName', { params: { name } })
      .then((res) => res.data)
  },

  /** POST /itemCategories/register (admin) -> { id }. */
  register(payload: ItemCategoryInput): Promise<CreatedResult> {
    return apiClient
      .post<CreatedResult>('/itemCategories/register', payload)
      .then((res) => res.data)
  },

  /** DELETE /itemCategories/deleteById?id= (admin) -> { affected }. */
  deleteById(id: number): Promise<AffectedResult> {
    return apiClient
      .delete<AffectedResult>('/itemCategories/deleteById', { params: { id } })
      .then((res) => res.data)
  },

  updateNameById(id: number, name: string): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/itemCategories/UpdateNameById', { name }, { params: { id } })
      .then((res) => res.data)
  },

  updateDescriptionById(id: number, description: string | null): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>(
        '/itemCategories/UpdateDescriptionById',
        { description },
        { params: { id } },
      )
      .then((res) => res.data)
  },

  updateParentById(id: number, parent: number | null): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>(
        '/itemCategories/UpdateParentById',
        { parent },
        { params: { id } },
      )
      .then((res) => res.data)
  },
}
