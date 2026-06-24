import { apiClient } from './client'
import type { AffectedResult } from '@/types/user'
import type {
  ChainVerifyResult,
  Order,
  OrderEvent,
  ORDER_STEP,
  ORDER_TYPE,
} from '@/types/order'

/** Shape returned by `POST /orders/purchaseRequests` / `outboundRequests`. */
export interface CreatedOrderResult {
  order_id: number
  event: OrderEvent
}

/** Payload for create-order endpoints. `note` becomes the event payload. */
export interface CreateOrderInput {
  item_id: number
  /** 0 → let the backend default to the current user. */
  user_id: number
  count: number
  /** Optional note; sent as the `event_payload` JSON `{ note }`. Omitted when empty. */
  note?: string
}

/** Payload for the append-step endpoints (approve/reject/receive/ship). */
export interface AppendEventInput {
  order_id: number
  /** Optional note; sent as the `event_payload` JSON `{ note }`. Omitted when empty. */
  note?: string
}

/**
 * Order API — wraps the order + event hash-chain endpoints exposed by the
 * Go/Gin backend (see backend/internal/controller/orderController.go
 * RegisterAuthRouter). All routes require a valid JWT; writes are
 * role-gated on the backend (purchaser/applicant/auditor/warehouse/admin).
 *
 *   POST /api/orders/purchaseRequests   (admin/purchaser) -> { order_id, event }
 *   POST /api/orders/outboundRequests   (admin/applicant) -> { order_id, event }
 *   POST /api/orders/auditApprove       (admin/auditor)   -> OrderEvent
 *   POST /api/orders/auditReject        (admin/auditor)   -> OrderEvent
 *   POST /api/orders/warehouseReceive   (admin/warehouse) -> OrderEvent
 *   POST /api/orders/warehouseShip      (admin/warehouse) -> OrderEvent
 *   GET  /api/orders/selectAll          (admin/auditor/warehouse) -> Order[]
 *   GET  /api/orders/selectById?id=                            -> Order
 *   GET  /api/orders/selectByUserId?user_id=                   -> Order[]
 *   GET  /api/orders/events?order_id=                          -> OrderEvent[]
 *   GET  /api/orders/verifyChain?order_id=                     -> ChainVerifyResult
 *
 * The append endpoints read JSON `{ order_id, event_payload }`. `event_payload`
 * is json.RawMessage; we send `{ note }` when a note is provided, otherwise
 * omit it (the backend tolerates a missing/null payload).
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure.
 */
type OrderStep = (typeof ORDER_STEP)[keyof typeof ORDER_STEP]
type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE]

/** Wrap an optional note into the `event_payload` JSON, or omit it. */
function buildPayload(note?: string): { event_payload?: { note: string } } {
  const v = (note ?? '').trim()
  return v ? { event_payload: { note: v } } : {}
}

export const ordersApi = {
  createPurchaseRequest(input: CreateOrderInput): Promise<CreatedOrderResult> {
    return apiClient
      .post<CreatedOrderResult>('/orders/purchaseRequests', { ...input, ...buildPayload(input.note) })
      .then((res) => res.data)
  },

  createOutboundRequest(input: CreateOrderInput): Promise<CreatedOrderResult> {
    return apiClient
      .post<CreatedOrderResult>('/orders/outboundRequests', { ...input, ...buildPayload(input.note) })
      .then((res) => res.data)
  },

  auditApprove(input: AppendEventInput): Promise<OrderEvent> {
    return apiClient
      .post<OrderEvent>('/orders/auditApprove', { order_id: input.order_id, ...buildPayload(input.note) })
      .then((res) => res.data)
  },

  auditReject(input: AppendEventInput): Promise<OrderEvent> {
    return apiClient
      .post<OrderEvent>('/orders/auditReject', { order_id: input.order_id, ...buildPayload(input.note) })
      .then((res) => res.data)
  },

  warehouseReceive(input: AppendEventInput): Promise<OrderEvent> {
    return apiClient
      .post<OrderEvent>('/orders/warehouseReceive', { order_id: input.order_id, ...buildPayload(input.note) })
      .then((res) => res.data)
  },

  warehouseShip(input: AppendEventInput): Promise<OrderEvent> {
    return apiClient
      .post<OrderEvent>('/orders/warehouseShip', { order_id: input.order_id, ...buildPayload(input.note) })
      .then((res) => res.data)
  },

  /** DELETE /orders/delete?id= -> { affected }. Soft delete (appends ORDER_DELETED event). */
  delete(orderId: number): Promise<AffectedResult> {
    return apiClient
      .delete<AffectedResult>('/orders/delete', { params: { id: orderId } })
      .then((res) => res.data)
  },

  selectAll(): Promise<Order[]> {
    return apiClient.get<Order[]>('/orders/selectAll').then((res) => res.data)
  },

  selectById(id: number): Promise<Order> {
    return apiClient.get<Order>('/orders/selectById', { params: { id } }).then((res) => res.data)
  },

  selectByUserId(userId: number): Promise<Order[]> {
    return apiClient
      .get<Order[]>('/orders/selectByUserId', { params: { user_id: userId } })
      .then((res) => res.data)
  },

  events(orderId: number): Promise<OrderEvent[]> {
    return apiClient
      .get<OrderEvent[]>('/orders/events', { params: { order_id: orderId } })
      .then((res) => res.data)
  },

  verifyChain(orderId: number): Promise<ChainVerifyResult> {
    return apiClient
      .get<ChainVerifyResult>('/orders/verifyChain', { params: { order_id: orderId } })
      .then((res) => res.data)
  },
}

// Re-export the step/type unions for convenience so callers can import from one place.
export type { OrderStep, OrderType }
