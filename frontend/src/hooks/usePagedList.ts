import { useCallback, useEffect, useRef, useState } from 'react'
import type { PageParams, Paginated } from '@/types/pagination'
import { fetchAll } from '@/api/pagination'
import { toApiError, type ApiError } from '@/api/errors'

export interface UsePagedListOptions<T> {
  /** The resource's paginated `selectAll` ({ page, page_size } -> { list, total }). */
  loadPage: (params: PageParams) => Promise<Paginated<T>>
  pageSize: number
  /**
   * When `true`, the hook is in "search mode": it fetches EVERY record once
   * (via `fetchAll`) and returns them all as `rows`, so the caller can filter
   * client-side across the full set. A false→true transition triggers one
   * fetchAll; a true→false transition returns to server-side paging at page 1.
   *
   * Use this for list pages whose client-side filter must search across all
   * rows (the backend exposes no filtered+paginated query). Drive it from the
   * filter term, e.g. `searchMode: searchTerm.trim() !== ''`.
   */
  searchMode: boolean
}

export interface UsePagedListResult<T> {
  /**
   * Rows for the current view: the current page in paged mode, or every row in
   * search mode. The caller applies its own client-side filter to these.
   */
  rows: T[]
  /** Total row count (backend `total` in paged mode; full-set length in search). */
  total: number
  page: number
  loading: boolean
  error: ApiError | null
  /** Reload the current view (current page in paged mode; full set in search). */
  reload: () => void
  /** Navigate to a page. Ignored in search mode. */
  goToPage: (page: number) => void
}

/**
 * Server-side pagination for a flat list, with an optional "search mode" that
 * falls back to fetching all rows so a client-side filter can match across the
 * whole dataset.
 *
 * The backend only offers a paginated `selectAll` (no filtered query), so a
 * client-side search box can only search the current page. To keep search
 * correct, flip `searchMode` on while a filter term is active: the hook then
 * fetches the full set once and the caller filters it; paging is hidden. When
 * the term clears, server-side paging resumes.
 */
export function usePagedList<T>({
  loadPage,
  pageSize,
  searchMode,
}: UsePagedListOptions<T>): UsePagedListResult<T> {
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  const loadPaged = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      setError(null)
      try {
        const { list, total: t } = await loadPage({ page: targetPage, page_size: pageSize })
        setRows(list)
        setTotal(t)
        setPage(targetPage)
      } catch (err) {
        setError(toApiError(err))
      } finally {
        setLoading(false)
      }
    },
    [loadPage, pageSize],
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await fetchAll(loadPage)
      setRows(all)
      setTotal(all.length)
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setLoading(false)
    }
  }, [loadPage])

  const reload = useCallback(() => {
    if (searchMode) void loadAll()
    else void loadPaged(page)
  }, [searchMode, loadAll, loadPaged, page])

  const goToPage = useCallback(
    (targetPage: number) => {
      if (searchMode) return
      void loadPaged(targetPage)
    },
    [searchMode, loadPaged],
  )

  // Mount: load page 1 (searchMode is false at mount in practice).
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    void loadPaged(1)
    return () => {
      mounted.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React to search-mode transitions: entering fetches all, leaving returns to page 1.
  const prevSearch = useRef(false)
  useEffect(() => {
    if (!mounted.current) return
    if (searchMode && !prevSearch.current) {
      void loadAll()
    } else if (!searchMode && prevSearch.current) {
      void loadPaged(1)
    }
    prevSearch.current = searchMode
  }, [searchMode, loadAll, loadPaged])

  return { rows, total, page, loading, error, reload, goToPage }
}
