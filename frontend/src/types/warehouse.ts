/**
 * Mirrors backend model `internal/database/model/warehouse.go` and the
 * `warehouses` table migration. Keep in sync if the backend schema changes.
 *
 * Note: the backend model tags the timestamp as `json:"create_at"` (NOT
 * `created_at`) — the field is named `CreateAt` in Go. Keep this quirk in
 * sync here.
 *
 * `description` is `*string` (nullable) — null when unset.
 */
export interface Warehouse {
  id: number
  name: string
  description: string | null
  /** Backend serializes this as `create_at` (model.CreateAt). */
  create_at: string
}

/**
 * Payload for `POST /api/warehouses/register`. The backend binds
 * {name, description}; `name` is required, `description` is optional.
 */
export interface WarehouseInput {
  name: string
  description: string | null
}
