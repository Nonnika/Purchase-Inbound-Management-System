import { apiClient } from './client'
import type { PageParams, Paginated } from '@/types/pagination'
import type { AffectedResult } from '@/types/user'
import type { CreatedResult, Department, DepartmentInput } from '@/types/department'

/**
 * Department API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/departmentController.go RegisterAuthRouter).
 *
 * All routes live on the `auth` group, so every call requires a valid JWT
 * (attached by the client interceptor). Write routes are additionally
 * admin-gated (middleware.Role(RoleAdmin)) on the backend.
 *
 *   POST   /api/departments/selectAll       (body {page, page_size} -> {list, total})
 *   GET    /api/departments/selectById?id=<int>       -> Department   (400 id / 404)
 *   GET    /api/departments/selectByName?name=<str>   -> Department   (400 name / 404)
 *   POST   /api/departments/register        (admin)   -> { id }       (JSON: DepartmentInput)
 *   DELETE /api/departments/deleteById?id=   (admin)   -> { affected }
 *   POST   /api/departments/UpdateNameById?id=        -> { affected } (JSON: { name })
 *   POST   /api/departments/UpdateDescriptionById?id= -> { affected } (JSON: { description })
 *   POST   /api/departments/UpdateParentById?id=      -> { affected } (JSON: { parent })
 *
 * The Update* handlers use Gin ShouldBind, which accepts JSON or form data;
 * we send JSON for consistency. Nullable fields (`description`, `parent`) are
 * sent as JSON `null` — the backend normalizes nil/0 → nil.
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure,
 * carrying the HTTP status, a stable code, a short reason, and the backend detail.
 */
export const departmentsApi = {
  /** Paginated department list. POST `{ page, page_size }` -> `{ list, total }` (id desc). */
  selectAll(params: PageParams = {}): Promise<Paginated<Department>> {
    return apiClient
      .post<Paginated<Department>>('/departments/selectAll', params)
      .then((res) => res.data)
  },

  selectById(id: number): Promise<Department> {
    return apiClient
      .get<Department>('/departments/selectById', { params: { id } })
      .then((res) => res.data)
  },

  selectByName(name: string): Promise<Department> {
    return apiClient
      .get<Department>('/departments/selectByName', { params: { name } })
      .then((res) => res.data)
  },

  /** POST /departments/register (admin) -> { id }. Returns the new department id. */
  register(payload: DepartmentInput): Promise<CreatedResult> {
    return apiClient.post<CreatedResult>('/departments/register', payload).then((res) => res.data)
  },

  /** DELETE /departments/deleteById?id= (admin) -> { affected }. */
  deleteById(id: number): Promise<AffectedResult> {
    return apiClient
      .delete<AffectedResult>('/departments/deleteById', { params: { id } })
      .then((res) => res.data)
  },

  updateNameById(id: number, name: string): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/departments/UpdateNameById', { name }, { params: { id } })
      .then((res) => res.data)
  },

  updateDescriptionById(id: number, description: string | null): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>(
        '/departments/UpdateDescriptionById',
        { description },
        { params: { id } },
      )
      .then((res) => res.data)
  },

  updateParentById(id: number, parent: number | null): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/departments/UpdateParentById', { parent }, { params: { id } })
      .then((res) => res.data)
  },
}
