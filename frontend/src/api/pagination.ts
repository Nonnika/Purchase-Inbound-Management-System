import type { PageParams, Paginated } from '@/types/pagination'

/**
 * The backend caps `page_size` at 100 (see pagination.go `maxPageSize`). We
 * request the maximum on every auto-page call to minimize round-trips.
 */
const MAX_PAGE_SIZE = 100

/** Guard against a misbehaving server that never terminates. */
const MAX_PAGES = 10000

/**
 * Auto-page through a paginated `selectAll`-style endpoint and collect every
 * record into a single array.
 *
 * Use this for callers that need the **full** set — tree views (departments /
 * categories, which must rebuild parent-child adjacency) and picker/name-
 * resolution loads (role/department/category/warehouse dropdowns, detail-page
 * id→name lookups). For these the server-side `page`/`page_size` navigation is
 * meaningless; they just need every row.
 *
 * For growing flat lists that the user pages through interactively, call the
 * resource API's `selectAll({ page, page_size })` directly and render a pager —
 * do NOT route those through `fetchAll`.
 */
export async function fetchAll<T>(
  load: (params: PageParams) => Promise<Paginated<T>>,
): Promise<T[]> {
  const acc: T[] = []
  let page = 1
  for (;;) {
    const { list, total } = await load({ page, page_size: MAX_PAGE_SIZE })
    acc.push(...list)
    // Stop once we've collected the reported total, or a page came back empty
    // (defensive: avoids an infinite loop if total is bogus).
    if (acc.length >= total || list.length === 0) break
    page += 1
    if (page > MAX_PAGES) break
  }
  return acc
}
