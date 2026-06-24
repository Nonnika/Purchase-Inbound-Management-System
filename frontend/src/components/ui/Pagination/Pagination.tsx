import { Button } from '@/components/ui/Button/Button'
import styles from './Pagination.module.css'

export interface PaginationProps {
  /** 1-based current page. */
  page: number
  /** Number of rows returned per page (the page_size sent to the backend). */
  pageSize: number
  /** Total row count reported by the backend (`Paginated.total`). */
  total: number
  /** Loading flag — disables navigation while a page is being fetched. */
  loading?: boolean
  /** Fired with the new 1-based page when the user navigates. */
  onChange: (page: number) => void
}

/**
 * Carbon-inspired pager for server-paginated lists.
 *
 * Shows a "共 N 条 · 第 X / Y 页" summary plus prev / windowed page-number
 * buttons / next. 0px radius, IBM Plex Mono for the numeric summary, Blue 60
 * accent for the active page — matches the design system tokens.
 *
 * Renders nothing when there is no data (`total === 0`) so list pages can drop
 * it unconditionally into their empty state without showing a stray pager.
 */
export function Pagination({ page, pageSize, total, loading, onChange }: PaginationProps) {
  if (total <= 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)

  // Windowed page list: always show first, last, current ±1, with ellipses.
  const pages = pageWindow(current, totalPages)

  return (
    <nav className={styles.pager} aria-label="分页导航">
      <span className={styles.summary}>
        共 <span className={styles.num}>{total}</span> 条 · 第 {current} / {totalPages} 页
      </span>
      <div className={styles.controls}>
        <Button
          variant="ghost"
          onClick={() => onChange(current - 1)}
          disabled={loading || current <= 1}
        >
          上一页
        </Button>
        <div className={styles.pages}>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className={styles.gap} aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={[styles.pageBtn, p === current ? styles.active : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onChange(p)}
                disabled={loading}
                aria-current={p === current ? 'page' : undefined}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => onChange(current + 1)}
          disabled={loading || current >= totalPages}
        >
          下一页
        </Button>
      </div>
    </nav>
  )
}

/**
 * Build a windowed list of page numbers (1-based) plus `'…'` ellipsis markers.
 * Always includes the first and last page; shows a sliding window around the
 * current page. Small page counts collapse to a plain contiguous list.
 *
 * Example: current=7, total=20 -> [1, '…', 6, 7, 8, '…', 20]
 */
function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const result: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) result.push('…')
  for (let p = start; p <= end; p++) result.push(p)
  if (end < total - 1) result.push('…')
  result.push(total)
  return result
}
