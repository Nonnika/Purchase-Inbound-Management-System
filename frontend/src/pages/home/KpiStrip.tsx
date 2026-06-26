import styles from './KpiStrip.module.css'

/** 紧凑货币：¥1,234.56 / ¥1.2万 / ¥1.2亿 —— 保持 32px mono 格内可读。 */
function formatCargoValue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1e8) return `¥${(value / 1e8).toFixed(2)}亿`
  if (value >= 1e4) return `¥${(value / 1e4).toFixed(1)}万`
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface KpiStripProps {
  /** 在库总货值（CalSum id=0）；null 表示加载失败/未就绪，显示 —。 */
  cargoValue: number | null
  itemTotal: number
  pendingAudit: number
  purchaseRequesting: number
  outboundRequesting: number
}

/**
 * KPI 三格：主格在库总货值（高亮）+ 物品总数 + 待审核订单。
 * 「待出入库」「库存不足」降为下方模块导语，不在 KPI 层重复。
 */
export function KpiStrip({
  cargoValue,
  itemTotal,
  pendingAudit,
  purchaseRequesting,
  outboundRequesting,
}: KpiStripProps) {
  return (
    <div className={styles.kpis}>
      <div className={`${styles.kpi} ${styles.kpiHighlight}`}>
        <div className={styles.kpiLabel}>在库总货值</div>
        <div className={styles.kpiValue}>{cargoValue == null ? '—' : formatCargoValue(cargoValue)}</div>
        <div className={styles.kpiSub}>全部仓库总值</div>
      </div>
      <div className={styles.kpi}>
        <div className={styles.kpiLabel}>物品总数</div>
        <div className={styles.kpiValue}>{itemTotal.toLocaleString('zh-CN')}</div>
        <div className={styles.kpiSub}>全部在库物品</div>
      </div>
      <div className={styles.kpi}>
        <div className={styles.kpiLabel}>待审核订单</div>
        <div className={styles.kpiValue}>{pendingAudit.toLocaleString('zh-CN')}</div>
        <div className={styles.kpiSub}>
          进货 {purchaseRequesting} · 出货 {outboundRequesting}
        </div>
      </div>
    </div>
  )
}
