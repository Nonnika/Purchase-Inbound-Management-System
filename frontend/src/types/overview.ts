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
