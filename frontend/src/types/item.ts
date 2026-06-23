/**
 * Mirrors backend model `internal/database/model/item.go` and the `items`
 * table migration. Keep in sync if the backend schema changes.
 *
 * All optional numeric fields are pointers on the backend (nullable in DB):
 *   category_id, price, item_inventory, frozen_inventory, warehouse_id,
 *   warning_level are `*int64` / `*float64` — null when unset.
 */
export interface Item {
  id: number
  name: string
  category_id: number | null
  price: number | null
  item_inventory: number | null
  frozen_inventory: number | null
  warehouse_id: number | null
  warning_level: number | null
  created_at: string
  updated_at: string
}

/**
 * Payload for `POST /api/items/create`. The backend `Create` handler binds
 * these via Gin ShouldBind (pointers) and requires `name` to be non-empty.
 * Validation enforced server-side: item_inventory ≥ 0, frozen_inventory ≥ 0,
 * and frozen_inventory ≤ item_inventory when both are set. All fields except
 * `name` are optional; omitted optionals serialize to JSON `null` and the
 * backend normalizes nil pointers appropriately.
 */
export interface ItemInput {
  name: string
  category_id: number | null
  price: number | null
  item_inventory: number | null
  frozen_inventory: number | null
  warehouse_id: number | null
  warning_level: number | null
}

/**
 * Payload for `POST /api/items/update?id=`. Mirrors the backend
 * `updateItemRequest` — every field is an optional pointer, so only changed
 * fields are sent. Omitted fields are left untouched server-side.
 */
export type ItemUpdate = Partial<ItemInput>
