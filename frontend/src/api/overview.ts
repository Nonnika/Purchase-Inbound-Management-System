import { apiClient } from './client'
import type { OverviewSummary } from '@/types/overview'

/**
 * Overview API — the aggregates backing the HomePage console.
 *
 *   GET /api/overview/summary  ->  OverviewSummary
 *
 * Registered in the auth group (overviewController.go RegisterAuthRouter), so
 * any authenticated role may call it; no specific role is enforced. Rejects
 * with an `ApiError` (see src/api/errors.ts) on failure.
 */
export const overviewApi = {
  summary(): Promise<OverviewSummary> {
    return apiClient.get<OverviewSummary>('/overview/summary').then((res) => res.data)
  },
}
