import { apiClient } from './client'
import type { PageParams, Paginated } from '@/types/pagination'
import type { Role } from '@/types/role'

/**
 * Role API — wraps the read-only endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/roleController.go RegisterAuthRouter).
 * All routes require a valid JWT (attached by the client interceptor); no
 * specific role is enforced beyond being authenticated.
 *   POST /api/roles/selectAll  (body {page, page_size} -> {list, total})
 *   GET /api/roles/selectById?id=<int>  -> Role   (400 id required / 404)
 *   GET /api/roles/selectByName?name=   -> Role   (400 name required / 404)
 *   GET /api/roles/selectByCode?code=   -> Role   (400 code required / 404)
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure.
 */
export const rolesApi = {
  /** Paginated role list. POST `{ page, page_size }` -> `{ list, total }` (id desc). */
  selectAll(params: PageParams = {}): Promise<Paginated<Role>> {
    return apiClient.post<Paginated<Role>>('/roles/selectAll', params).then((res) => res.data)
  },

  selectById(id: number): Promise<Role> {
    return apiClient
      .get<Role>('/roles/selectById', { params: { id } })
      .then((res) => res.data)
  },

  selectByName(name: string): Promise<Role> {
    return apiClient
      .get<Role>('/roles/selectByName', { params: { name } })
      .then((res) => res.data)
  },

  selectByCode(code: string): Promise<Role> {
    return apiClient
      .get<Role>('/roles/selectByCode', { params: { code } })
      .then((res) => res.data)
  },
}
