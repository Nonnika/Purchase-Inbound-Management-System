import type { OverviewSummary } from '@/types/overview'
import { Tag, type TagKind } from '@/components/ui/Tag/Tag'
import shared from './shared.module.css'
import styles from './OrderStatusPanel.module.css'

/** Map a Tag kind to its fill color for the distribution bars. */
const KIND_FILL: Record<TagKind, string> = {
  blue: 'var(--blue-60)',
  green: 'var(--green-50)',
  red: 'var(--red-60)',
  gray: 'var(--gray-50)',
}

interface StatusRow {
  key: string
  label: string
  count: number
  kind: TagKind
  hint?: string
}

interface OrderStatusPanelProps {
  summary: OverviewSummary
}

/**
 * 订单状态分布面板。从 summary 派生各行计数，按比例画进度条。
 * totalOrders 跨所有非删除状态，使比例条共享一个刻度。
 */
export function OrderStatusPanel({ summary }: OrderStatusPanelProps) {
  const statusRows: StatusRow[] = [
    {
      key: 'pending',
      label: '申请中',
      count: summary.pending_audit,
      kind: 'gray',
      hint: `进货 ${summary.purchase_requesting} · 出货 ${summary.outbound_requesting}`,
    },
    { key: 'approved', label: '审核通过', count: summary.audit_approved, kind: 'blue' },
    { key: 'received', label: '已入库', count: summary.warehouse_received, kind: 'green' },
    { key: 'shipped', label: '已出库', count: summary.warehouse_shipped, kind: 'green' },
    { key: 'rejected', label: '已驳回', count: summary.audit_rejected, kind: 'red' },
  ]

  const totalOrders = statusRows.reduce((sum, r) => sum + r.count, 0)

  return (
    <section className={shared.panel}>
      <div className={shared.panelHead}>
        <h2 className={shared.panelTitle}>订单状态分布</h2>
        <span className={shared.panelMeta}>共 {totalOrders} 单</span>
      </div>
      {totalOrders === 0 ? (
        <p className={shared.muted}>暂无订单数据。</p>
      ) : (
        <div className={styles.statusList}>
          {statusRows.map((row) => {
            const pct = totalOrders > 0 ? (row.count / totalOrders) * 100 : 0
            return (
              <div key={row.key} className={styles.statusRow}>
                <div className={styles.statusLabel}>
                  <Tag kind={row.kind}>{row.label}</Tag>
                  {row.hint && <span className={styles.statusHint}>{row.hint}</span>}
                </div>
                <div className={styles.bar} aria-hidden>
                  <div
                    className={styles.barFill}
                    style={{ width: `${pct}%`, background: KIND_FILL[row.kind] }}
                  />
                </div>
                <div className={styles.statusCount}>{row.count}</div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
