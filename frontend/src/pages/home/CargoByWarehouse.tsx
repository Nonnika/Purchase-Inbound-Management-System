import type { ReactNode } from 'react'
import type { CargoByWarehouse as CargoByWarehouseData } from '@/types/overview'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import { toApiError } from '@/api/errors'
import shared from './shared.module.css'
import styles from './CargoByWarehouse.module.css'

interface CargoByWarehouseProps {
  /** 仓库货值分布；null=加载中，undefined=失败。 */
  data: CargoByWarehouseData | null | undefined
  error: unknown
}

/** ¥ 紧凑格式（与 KPI 货值口径一致）。 */
function fmt(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1e8) return `¥${(value / 1e8).toFixed(2)}亿`
  if (value >= 1e4) return `¥${(value / 1e4).toFixed(1)}万`
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

/**
 * 货值按仓库分布：每行「仓名 | 占比条 | sum + 占比%」。
 * 按 sum 降序展示。total=0 时显示占位。
 */
export function CargoByWarehouse({ data, error }: CargoByWarehouseProps) {
  let body: ReactNode
  if (data === undefined) {
    body = <ErrorBanner error={toApiError(error)} prefix="无法加载货值分布" />
  } else if (data === null) {
    body = <p className={shared.muted}>正在加载货值分布…</p>
  } else if (data.total === 0) {
    body = <p className={shared.muted}>暂无货值数据。</p>
  } else {
    const rows = [...data.warehouses].sort((a, b) => b.sum - a.sum)
    body = (
      <div>
        {rows.map((w) => {
          const pct = data.total > 0 ? (w.sum / data.total) * 100 : 0
          return (
            <div key={w.warehouse_id} className={styles.row}>
              <div className={styles.name} title={w.name}>
                {w.name}
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${pct}%` }} />
              </div>
              <div className={styles.value}>
                <div className={styles.valueSum}>{fmt(w.sum)}</div>
                <div className={styles.valuePct}>{pct.toFixed(1)}%</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <section className={shared.panel}>
      <div className={shared.panelHead}>
        <h2 className={shared.panelTitle}>货值按仓库分布</h2>
        {data && data.total > 0 && (
          <span className={shared.panelMeta}>合计 {fmt(data.total)}</span>
        )}
      </div>
      {body}
    </section>
  )
}
