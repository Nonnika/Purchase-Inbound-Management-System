import type { ReactNode } from 'react'
import type { Item } from '@/types/item'
import { topValueItems } from './aggregate'
import shared from './shared.module.css'
import styles from './TopValueItems.module.css'

interface TopValueItemsProps {
  items: Item[] | null
}

/** ¥ 紧凑格式。 */
function fmt(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1e8) return `¥${(value / 1e8).toFixed(2)}亿`
  if (value >= 1e4) return `¥${(value / 1e4).toFixed(1)}万`
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

/**
 * 高货值物品 Top5：按 price×item_inventory 降序（null price 跳过）。
 * items=null 表示加载中/失败。
 */
export function TopValueItems({ items }: TopValueItemsProps) {
  let body: ReactNode
  if (items === null) {
    body = <p className={shared.muted}>正在加载高货值物品…</p>
  } else {
    const rows = topValueItems(items, 5)
    body =
      rows.length === 0 ? (
        <p className={shared.muted}>暂无物品数据。</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>物品</th>
              <th className={styles.num}>单价</th>
              <th className={styles.num}>库存</th>
              <th className={styles.num}>货值</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, value }) => (
              <tr key={item.id}>
                <td className={styles.name} title={item.name}>
                  {item.name}
                </td>
                <td className={styles.num}>{item.price != null ? fmt(item.price) : '—'}</td>
                <td className={styles.num}>{item.item_inventory ?? '—'}</td>
                <td className={`${styles.num} ${styles.value}`}>{fmt(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
  }

  return (
    <section className={shared.panel}>
      <div className={shared.panelHead}>
        <h2 className={shared.panelTitle}>高货值物品</h2>
      </div>
      {body}
    </section>
  )
}
