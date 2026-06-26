import type { ReactNode } from 'react'
import type { Item } from '@/types/item'
import { lowInventoryTop } from './aggregate'
import shared from './shared.module.css'
import styles from './LowInventoryRank.module.css'

interface LowInventoryRankProps {
  items: Item[] | null
}

/**
 * 库存预警排行 Top5：筛 item_inventory ≤ warning_level，按缺口降序。
 * items=null 表示加载中/失败；空数组经聚合后为空列表。
 */
export function LowInventoryRank({ items }: LowInventoryRankProps) {
  let body: ReactNode
  if (items === null) {
    body = <p className={shared.muted}>正在加载库存预警…</p>
  } else {
    const rows = lowInventoryTop(items, 5)
    body =
      rows.length === 0 ? (
        <p className={shared.muted}>暂无库存预警。</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>物品</th>
              <th className={styles.num}>库存</th>
              <th className={styles.num}>预警值</th>
              <th className={styles.num}>缺口</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, gap }) => (
              <tr key={item.id}>
                <td className={styles.name} title={item.name}>
                  {item.name}
                </td>
                <td className={styles.num}>{item.item_inventory ?? '—'}</td>
                <td className={styles.num}>{item.warning_level ?? '—'}</td>
                <td className={`${styles.num} ${styles.gap}`}>{gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
  }

  return (
    <section className={shared.panel}>
      <div className={shared.panelHead}>
        <h2 className={shared.panelTitle}>库存预警排行</h2>
      </div>
      {body}
    </section>
  )
}
