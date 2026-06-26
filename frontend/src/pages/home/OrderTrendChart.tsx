import type { ReactNode } from 'react'
import type { OrderTrend } from '@/types/overview'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import { toApiError } from '@/api/errors'
import shared from './shared.module.css'
import styles from './OrderTrendChart.module.css'

interface OrderTrendChartProps {
  /** 趋势数据；null=加载中，undefined=加载失败。 */
  trend: OrderTrend | null | undefined
  /** 失败原因（trend === undefined 时用）。 */
  error: unknown
}

/** 取 buckets 末项日期（今日）的 YYYY-MM-DD，用于判定当日柱。 */
function lastDate(buckets: OrderTrend['buckets']): string | null {
  if (buckets.length === 0) return null
  return buckets[buckets.length - 1].date
}

/** 仅显示 MM-DD，节省横向空间。 */
function shortDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length < 3) return iso
  return `${parts[1]}-${parts[2]}`
}

/**
 * 近 14 天每日订单数柱状图（纯 CSS）。每列高度按当日 count / maxCount 比例。
 * null=加载中、undefined=失败、空 buckets=无数据。
 */
export function OrderTrendChart({ trend, error }: OrderTrendChartProps) {
  const buckets = trend?.buckets ?? []
  const maxCount = Math.max(1, ...buckets.map((b) => b.count))
  const today = lastDate(buckets)
  const total = buckets.reduce((s, b) => s + b.count, 0)

  let body: ReactNode
  if (trend === undefined) {
    body = <ErrorBanner error={toApiError(error)} prefix="无法加载趋势数据" />
  } else if (trend === null) {
    body = <p className={shared.muted}>正在加载趋势数据…</p>
  } else if (buckets.length === 0 || total === 0) {
    body = <p className={shared.muted}>近 {trend.days} 天无订单。</p>
  } else {
    body = (
      <div className={styles.chart}>
        {buckets.map((b) => {
          const h = maxCount > 0 ? (b.count / maxCount) * 100 : 0
          const isToday = b.date === today
          return (
            <div key={b.date} className={styles.col}>
              {b.count > 0 && (
                <div className={styles.tooltip}>
                  {b.date} · {b.count} 单
                </div>
              )}
              <div className={styles.barWrap}>
                <div
                  className={`${styles.bar} ${isToday ? styles.barToday : ''}`}
                  style={{ height: `${h}%` }}
                  title={`${b.date} · ${b.count} 单`}
                />
              </div>
              <div className={styles.dateLabel}>{shortDate(b.date)}</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <section className={shared.panel}>
      <div className={shared.panelHead}>
        <h2 className={shared.panelTitle}>订单趋势</h2>
        <span className={shared.panelMeta}>近 {trend?.days ?? 14} 天 · 共 {total} 单</span>
      </div>
      {body}
    </section>
  )
}
