import { formatCargoValue } from '@/utils/currency'
import styles from './KpiStrip.module.css'

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
