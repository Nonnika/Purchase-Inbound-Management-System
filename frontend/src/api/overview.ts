import { apiClient } from './client'
import type {
  CargoByWarehouse,
  OrderTrend,
  OverviewSummary,
} from '@/types/overview'

/**
 * Overview API — the aggregates backing the HomePage console.
 *
 *   GET /api/overview/summary            -> OverviewSummary       (any auth role)
 *   GET /api/overview/orderTrend?days=   -> OrderTrend            (any auth role)
 *   GET /api/overview/cargoByWarehouse   -> CargoByWarehouse      (any auth role)
 *
 * All three live in the auth group (overviewController.go RegisterAuthRouter),
 * so any authenticated role may call them; no specific role is enforced.
 * Reject with an `ApiError` (see src/api/errors.ts) on failure.
 */
export const overviewApi = {
  summary(): Promise<OverviewSummary> {
    return apiClient.get<OverviewSummary>('/overview/summary').then((res) => res.data)
  },

  /**
   * 近 N 天每日新建订单数。`days` 默认 14，范围 [1,90]。
   * 后端返回长度恒等于 days 的 buckets（日期升序，无订单日 count=0）。
   */
  orderTrend(days = 14): Promise<OrderTrend> {
    return apiClient
      .get<OrderTrend>('/overview/orderTrend', { params: { days } })
      .then((res) => res.data)
  },

  /** 各仓货值分布（Σ price×item_inventory，含冻结）。 */
  cargoByWarehouse(): Promise<CargoByWarehouse> {
    return apiClient
      .get<CargoByWarehouse>('/overview/cargoByWarehouse')
      .then((res) => res.data)
  },
}
