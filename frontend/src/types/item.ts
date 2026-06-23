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
