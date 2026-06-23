/**
 * Mirrors backend model `internal/database/model/order.go` and the `orders` /
 * `order_events` table migrations. Keep these in sync if the backend schema
 * changes.
 *
 * The order lifecycle is a hash-chained event log. Each order has an
 * `order_type` (PURCHASE / OUTBOUND) and a `status` that mirrors the latest
 * appended event's step. Events form a chain via `previous_event_hash` →
 * `event_hash`; `GET /orders/verifyChain` recomputes the chain server-side.
 *
 * Role ownership (backend/internal/controller/orderController.go):
 *   purchaser  → create PURCHASE orders
 *   applicant  → create OUTBOUND orders
 *   auditor    → audit approve / reject
 *   warehouse  → receive (PURCHASE) / ship (OUTBOUND)
 *   admin      → everything
 */
export interface Order {
  id: number
  item_id: number
  user_id: number
  count: number
  /** "PURCHASE" (进货) | "OUTBOUND" (出货) */
  order_type: string
  /** Current lifecycle step — see ORDER_STEP. */
  status: string
  created_at: string
  updated_at: string
}

/**
 * One node in the order event hash-chain. `event_payload` is arbitrary JSON
 * (json.RawMessage on the backend) — we type it loosely and stringify for
 * display. `operator_user_id` / `previous_event_hash` are nullable.
 */
export interface OrderEvent {
  id: number
  order_id: number
  sequence_no: number
  step: string
  operator_user_id: number | null
  event_payload: unknown
  payload_hash: string
  previous_event_hash: string | null
  event_hash: string
  created_at: string
}

/** `GET /orders/verifyChain` result — whether the recomputed chain matches. */
export interface ChainVerifyResult {
  valid: boolean
  error?: string
}

/** Order types (dao.OrderType*). */
export const ORDER_TYPE = {
  PURCHASE: 'PURCHASE',
  OUTBOUND: 'OUTBOUND',
} as const

/** Lifecycle steps / statuses (dao.OrderStep*). */
export const ORDER_STEP = {
  PURCHASE_REQUESTED: 'PURCHASE_REQUESTED',
  OUTBOUND_REQUESTED: 'OUTBOUND_REQUESTED',
  AUDIT_APPROVED: 'AUDIT_APPROVED',
  AUDIT_REJECTED: 'AUDIT_REJECTED',
  WAREHOUSE_RECEIVED: 'WAREHOUSE_RECEIVED',
  WAREHOUSE_SHIPPED: 'WAREHOUSE_SHIPPED',
} as const

/**
 * Per-type flow: each status maps to the set of steps the order may transition
 * to next. Mirrors `validOrderTransitions` in orderDao.go. A terminal status
 * (AUDIT_REJECTED, WAREHOUSE_RECEIVED for PURCHASE, WAREHOUSE_SHIPPED for
 * OUTBOUND) has no further transitions.
 */
export const ORDER_NEXT_STEPS: Record<string, Record<string, string[]>> = {
  [ORDER_TYPE.PURCHASE]: {
    [ORDER_STEP.PURCHASE_REQUESTED]: [ORDER_STEP.AUDIT_APPROVED, ORDER_STEP.AUDIT_REJECTED],
    [ORDER_STEP.AUDIT_APPROVED]: [ORDER_STEP.WAREHOUSE_RECEIVED],
  },
  [ORDER_TYPE.OUTBOUND]: {
    [ORDER_STEP.OUTBOUND_REQUESTED]: [ORDER_STEP.AUDIT_APPROVED, ORDER_STEP.AUDIT_REJECTED],
    [ORDER_STEP.AUDIT_APPROVED]: [ORDER_STEP.WAREHOUSE_SHIPPED],
  },
}
