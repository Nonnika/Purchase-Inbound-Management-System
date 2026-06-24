import { apiClient } from './client'
import type { AffectedResult } from '@/types/user'
import type { CreatedResult } from '@/types/department'
import type { Warehouse, WarehouseInput } from '@/types/warehouse'

/**
 * Warehouse API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/warehouseController.go RegisterAuthRouter).
 *
 * All routes live on the `auth` group, so every call requires a valid JWT.
 * Write routes are admin-gated on the backend.
 *
 *   POST   /api/warehouses/register        (admin) -> { id }       (JSON: WarehouseInput)
 *   GET    /api/warehouses/selectAll                 -> Warehouse[]
 *   GET    /api/warehouses/selectById?id=            -> Warehouse   (400 id / 404)
 *   GET    /api/warehouses/selectByName?name=        -> Warehouse   (400 name / 404)
 *   DELETE /api/warehouses/deleteById?id=   (admin)  -> { affected }
 *   POST   /api/warehouses/UpdateNameById?id=        -> { affected } (JSON: { name })
 *   POST   /api/warehouses/UpdateDescriptionById?id= -> { affected } (JSON: { description })
 *
 * The Update* handlers use Gin ShouldBind (JSON or form); we send JSON for
 * consistency. Nullable `description` is sent as JSON `null` (backend
 * normalizes nil/"" → nil).
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure.
 */
export const warehousesApi = {
  selectAll(): Promise<Warehouse[]> {
    return apiClient.get<Warehouse[]>('/warehouses/selectAll').then((res) => res.data)
  },

  selectById(id: number): Promise<Warehouse> {
    return apiClient
      .get<Warehouse>('/warehouses/selectById', { params: { id } })
      .then((res) => res.data)
  },

  selectByName(name: string): Promise<Warehouse> {
    return apiClient
      .get<Warehouse>('/warehouses/selectByName', { params: { name } })
      .then((res) => res.data)
  },

  /** POST /warehouses/register (admin) -> { id }. */
  register(payload: WarehouseInput): Promise<CreatedResult> {
    return apiClient
      .post<CreatedResult>('/warehouses/register', payload)
      .then((res) => res.data)
  },

  /** DELETE /warehouses/deleteById?id= (admin) -> { affected }. */
  deleteById(id: number): Promise<AffectedResult> {
    return apiClient
      .delete<AffectedResult>('/warehouses/deleteById', { params: { id } })
      .then((res) => res.data)
  },

  updateNameById(id: number, name: string): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/warehouses/UpdateNameById', { name }, { params: { id } })
      .then((res) => res.data)
  },

  updateDescriptionById(id: number, description: string | null): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>(
        '/warehouses/UpdateDescriptionById',
        { description },
        { params: { id } },
      )
      .then((res) => res.data)
  },
}
