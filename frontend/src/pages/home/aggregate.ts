import type { Item } from '@/types/item'
import type { Warehouse } from '@/types/warehouse'
import type { CargoByWarehouse, CargoByWarehouseItem } from '@/types/overview'

/** 货值口径：Σ price × item_inventory，含冻结，null price 跳过（与 CalSum 一致）。 */
export function itemValue(item: Item): number {
  const price = item.price ?? 0
  const inv = item.item_inventory ?? 0
  return price * inv
}

/** 库存预警物品 + 缺口，按缺口降序取前 `limit`。 */
export function lowInventoryTop(
  items: Item[],
  limit = 5,
): { item: Item; gap: number }[] {
  return items
    .filter(
      (it) =>
        it.warning_level != null &&
        it.item_inventory != null &&
        it.item_inventory <= it.warning_level,
    )
    .map((it) => ({
      item: it,
      gap: (it.warning_level as number) - (it.item_inventory as number),
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, limit)
}

/** 高货值物品 Top，按 price×item_inventory 降序取前 `limit`（null price 跳过）。 */
export function topValueItems(
  items: Item[],
  limit = 5,
): { item: Item; value: number }[] {
  return items
    .filter((it) => it.price != null)
    .map((it) => ({ item: it, value: itemValue(it) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/**
 * 仓库货值兜底：cargoByWarehouse 端点失败时，从全量 items + warehouses 本地聚合。
 * 与 CalSum 同口径。无物品仓 sum=0 仍列出。
 */
export function cargoByWarehouseFallback(
  items: Item[],
  warehouses: Warehouse[],
): CargoByWarehouse {
  const byWh = new Map<number, number>()
  for (const it of items) {
    const wid = it.warehouse_id
    if (wid == null) continue
    byWh.set(wid, (byWh.get(wid) ?? 0) + itemValue(it))
  }
  const ws: CargoByWarehouseItem[] = warehouses.map((w) => ({
    warehouse_id: w.id,
    name: w.name,
    sum: byWh.get(w.id) ?? 0,
  }))
  const total = ws.reduce((s, w) => s + w.sum, 0)
  return { warehouses: ws, total }
}
