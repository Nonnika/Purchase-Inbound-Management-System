import { useCallback, useEffect, useMemo, useState } from 'react'
import { overviewApi } from '@/api/overview'
import { itemsApi } from '@/api/items'
import { warehousesApi } from '@/api/warehouses'
import { rolesApi } from '@/api/roles'
import { fetchAll } from '@/api/pagination'
import { toApiError, type ApiError } from '@/api/errors'
import { getCurrentUser } from '@/api/auth'
import type {
  CargoByWarehouse as CargoByWarehouseData,
  OrderTrend,
  OverviewSummary,
} from '@/types/overview'
import type { Item } from '@/types/item'
import type { Warehouse } from '@/types/warehouse'
import type { Role } from '@/types/role'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import { KpiStrip } from './KpiStrip'
import { OrderTrendChart } from './OrderTrendChart'
import { CargoByWarehouse } from './CargoByWarehouse'
import { LowInventoryRank } from './LowInventoryRank'
import { OrderStatusPanel } from './OrderStatusPanel'
import { TopValueItems } from './TopValueItems'
import { ShortcutGrid } from './ShortcutGrid'
import { cargoByWarehouseFallback } from './aggregate'
import styles from './HomePage.module.css'

type LoadState = 'loading' | 'error' | 'ready'

/**
 * HomePage —— 运营仪表盘容器。拉取 summary（致命）+ 5 个非致命并发数据，
 * 分发给各分析子模块。非致命失败由各模块自行占位，不阻断其余渲染。
 */
export function HomePage() {
  const user = getCurrentUser()
  const roleId = user?.role_id ?? 0

  const [summary, setSummary] = useState<OverviewSummary | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [cargoValue, setCargoValue] = useState<number | null>(null)
  // 三态：null=加载中，undefined=失败，对象=成功
  const [trend, setTrend] = useState<OrderTrend | null | undefined>(null)
  const [trendError, setTrendError] = useState<unknown>(null)
  const [cargoByWh, setCargoByWh] = useState<CargoByWarehouseData | null | undefined>(null)
  const [cargoByWhError, setCargoByWhError] = useState<unknown>(null)
  const [items, setItems] = useState<Item[] | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<ApiError | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError(null)
    // 非致命子模块先置为加载中（null），错误位清零。
    setTrend(null)
    setTrendError(null)
    setCargoByWh(null)
    setCargoByWhError(null)
    setItems(null)
    try {
      // summary 致命：决定整页能否渲染。其余并发 .catch 降级。
      const [s, rs, cv, tr, cw, its, whs] = await Promise.all([
        overviewApi.summary(),
        fetchAll(rolesApi.selectAll).catch(() => [] as Role[]),
        itemsApi.calSum(0).catch(() => null),
        overviewApi
          .orderTrend(14)
          .catch((e: unknown) => {
            setTrendError(e)
            return undefined
          }),
        overviewApi
          .cargoByWarehouse()
          .catch((e: unknown) => {
            setCargoByWhError(e)
            return undefined
          }),
        fetchAll(itemsApi.selectAll).catch(() => null),
        fetchAll(warehousesApi.selectAll).catch(() => [] as Warehouse[]),
      ])
      setSummary(s)
      setRoles(rs)
      setCargoValue(cv)
      setTrend(tr)
      setCargoByWh(cw)
      setItems(its)
      setWarehouses(whs)
      setUpdatedAt(new Date())
      setState('ready')
    } catch (err) {
      setError(toApiError(err))
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const roleName = useMemo(() => {
    const m = new Map<number, string>()
    roles.forEach((r) => m.set(r.id, r.name))
    return m
  }, [roles])

  // 仓库货值兜底：端点失败(undefined)时用全量 items + warehouses 本地聚合。
  // - 端点成功(对象或空分布) → 直接用
  // - null → 仍在加载中
  // - undefined 且 items 已就绪 → 本地兜底
  // - undefined 且 items 也失败 → 仍 undefined(模块显示错误占位)
  const cargoByWhResolved: CargoByWarehouseData | null | undefined = useMemo(() => {
    if (cargoByWh !== undefined) return cargoByWh
    if (items === null) return undefined // items 未就绪或失败 → 模块走错误占位
    return cargoByWarehouseFallback(items, warehouses)
  }, [cargoByWh, items, warehouses])

  const greeting = user ? `欢迎回来，${user.real_name || user.username}` : '欢迎回来'

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">控制台</div>
            <h1 className={styles.title}>概览</h1>
            <div className={styles.subtitle}>
              <span>{greeting}</span>
              {user && (
                <>
                  <span className={styles.dot} aria-hidden>
                    ·
                  </span>
                  <Tag kind="blue">{roleName.get(user.role_id) ?? `角色 #${user.role_id}`}</Tag>
                </>
              )}
            </div>
          </div>
          <div className={styles.headerActions}>
            {updatedAt && state === 'ready' && (
              <span className={styles.updatedAt}>更新于 {formatClock(updatedAt)}</span>
            )}
            <Button variant="tertiary" onClick={() => void load()} disabled={state === 'loading'}>
              {state === 'loading' ? '加载中…' : '刷新'}
            </Button>
          </div>
        </div>

        {state === 'error' ? (
          <ErrorBanner
            error={error ?? toApiError(new Error('加载失败'))}
            prefix="无法加载控制台数据"
            action={
              <Button variant="tertiary" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' ? (
          <p className={styles.muted}>正在加载控制台数据…</p>
        ) : summary ? (
          <>
            <KpiStrip
              cargoValue={cargoValue}
              itemTotal={summary.item_total}
              pendingAudit={summary.pending_audit}
              purchaseRequesting={summary.purchase_requesting}
              outboundRequesting={summary.outbound_requesting}
            />

            <OrderTrendChart trend={trend} error={trendError} />

            <div className={styles.duo}>
              <CargoByWarehouse data={cargoByWhResolved} error={cargoByWhError} />
              <LowInventoryRank items={items} />
            </div>

            <div className={styles.duo}>
              <OrderStatusPanel summary={summary} />
              <TopValueItems items={items} />
            </div>

            <ShortcutGrid roleId={roleId} />
          </>
        ) : null}
      </div>
    </section>
  )
}

/** HH:mm (local) for the "updated at" caption. */
function formatClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
