/**
 * Mirrors backend model `internal/database/model/departments.go` and the
 * `departments` table migration. Keep these fields in sync if the backend
 * schema changes.
 *
 * Notes on the current backend model:
 *   - `description` is `*string` (nullable) — null when unset.
 *   - `parent` is `*int64` (nullable) — null/0 means a root department
 *     (the backend normalizes `0` → `nil` via normalizeDepartmentParent).
 *   - `id` / `parent` are int64 on the backend; represented as `number` here
 *     (department ids stay well within JS safe-integer range).
 */
export interface Department {
  id: number
  name: string
  description: string | null
  parent: number | null
  created_at: string
}

/**
 * Payload for `POST /api/departments/register`. The backend binds
 * {name, description, parent}; `name` is required, the other two are optional.
 * `parent` of null/0 creates a root-level department.
 */
export interface DepartmentInput {
  name: string
  description: string | null
  parent: number | null
}

/** Shape returned by `POST /api/departments/register`: `{ id }` (the new row id). */
export interface CreatedResult {
  id: number
}
