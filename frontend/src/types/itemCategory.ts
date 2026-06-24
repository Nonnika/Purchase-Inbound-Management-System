/**
 * Mirrors backend model `internal/database/model/item_categories.go` and the
 * `item_categories` table migration. Keep in sync if the backend schema
 * changes.
 *
 * Notes:
 *   - `description` is `*string` (nullable) — null when unset.
 *   - `parent` is `*int64` (nullable) — null/0 means a root category (the
 *     backend normalizes `0` → `nil`). This forms a tree, like departments.
 *   - The Go field is `CreateAt` with db tag `create_at` but **json tag
 *     `created_at`** — so the API exposes `created_at`. Keep this quirk in
 *     sync here.
 */
export interface ItemCategory {
  id: number
  name: string
  description: string | null
  parent: number | null
  /** Backend serializes this as `created_at` (despite the db column `create_at`). */
  created_at: string
}

/**
 * Payload for `POST /api/itemCategories/register`. The backend binds
 * {name, description, parent}; `name` is required, the other two are optional.
 * `parent` of null/0 creates a root-level category.
 */
export interface ItemCategoryInput {
  name: string
  description: string | null
  parent: number | null
}
