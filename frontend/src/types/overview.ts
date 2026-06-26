/**
 * Mirrors backend `dao.OverviewSummary` (overviewDao.go) returned by
 * `GET /api/overview/summary`. Every field is an int64 count.
 *
 * Order status counts follow dao.OrderStep* (see ORDER_STEP in types/order.ts):
 *   pending_audit        = PURCHASE_REQUESTED + OUTBOUND_REQUESTED
 *   purchase_requesting  = PURCHASE_REQUESTED
 *   outbound_requesting  = OUTBOUND_REQUESTED
 *   audit_approved       = AUDIT_APPROVED
 *   audit_rejected       = AUDIT_REJECTED
 *   warehouse_received   = WAREHOUSE_RECEIVED
 *   warehouse_shipped    = WAREHOUSE_SHIPPED
 *
 * `low_inventory_count` counts items whose `warning_level` is not null and
 * `item_inventory <= warning_level` — note the backend compares against total
 * inventory, not available (frozen-adjusted) stock.
 */
export interface OverviewSummary {
  item_total: number
  low_inventory_count: number
  pending_audit: number
  purchase_requesting: number
  outbound_requesting: number
  audit_approved: number
  audit_rejected: number
  warehouse_received: number
  warehouse_shipped: number
}

/**
 * `GET /api/overview/orderTrend?days=` — 近 N 天每日新建订单数。
 * 后端按 `orders.created_at` 日期分桶，长度恒等于 `days`，按日期升序；
 * 无订单日 count=0；仅统计未软删订单。任意登录角色可调用。
 */
export interface OrderTrendBucket {
  /** 本地日期 YYYY-MM-DD（服务器时区）。 */
  date: string
  count: number
}
export interface OrderTrend {
  days: number
  buckets: OrderTrendBucket[]
}

/**
 * `GET /api/overview/cargoByWarehouse` — 各仓货值分布。
 * `sum` = 该仓 Σ price × item_inventory（含冻结，与 CalSum 同口径，null price 跳过）；
 * `total` = 各仓 sum 之和，应等于 CalSum?id=0。无物品仓 sum=0 仍列出。任意登录角色可调用。
 */
export interface CargoByWarehouseItem {
  warehouse_id: number
  name: string
  sum: number
}
export interface CargoByWarehouse {
  warehouses: CargoByWarehouseItem[]
  total: number
}
