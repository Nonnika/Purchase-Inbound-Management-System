import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { overviewApi } from '@/api/overview'
import { rolesApi } from '@/api/roles'
import { fetchAll } from '@/api/pagination'
import { toApiError, type ApiError } from '@/api/errors'
import { getCurrentUser } from '@/api/auth'
import type { OverviewSummary } from '@/types/overview'
import type { Role } from '@/types/role'
import { ROLE_ID } from '@/types/role'
import { Button } from '@/components/ui/Button/Button'
import { Tag, type TagKind } from '@/components/ui/Tag/Tag'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './HomePage.module.css'

type LoadState = 'loading' | 'error' | 'ready'

/**
 * Console shortcut tiles. `roles` restricts visibility by the current user's
 * role (undefined = every authenticated role), mirroring AppLayout's nav
 * gating so a tile never links to a page the user can't read (e.g. /users is
 * admin-only — the broken hero link the old marketing page had).
 */
interface Shortcut {
  to: string
  label: string
  desc: string
  tag: string
  tagKind: TagKind
  roles?: number[]
}

const SHORTCUTS: Shortcut[] = [
  { to: '/orders', label: '订单管理', desc: '采购申请、出库申请与订单流转', tag: '业务', tagKind: 'blue' },
  { to: '/items', label: '物品管理', desc: '物品档案、库存与预警阈值', tag: '库存', tagKind: 'green' },
  { to: '/warehouses', label: '仓库管理', desc: '仓库档案与存储统计', tag: '库存', tagKind: 'green' },
  { to: '/categories', label: '分类管理', desc: '物品分类树维护', tag: '基础', tagKind: 'gray' },
  { to: '/departments', label: '部门管理', desc: '组织架构树维护', tag: '基础', tagKind: 'gray' },
  { to: '/users', label: '用户管理', desc: '用户、角色与封禁', tag: '权限', tagKind: 'gray', roles: [ROLE_ID.ADMIN] },
]

/** One row in the order-status distribution panel. */
interface StatusRow {
  key: string
  label: string
  count: number
  kind: TagKind
  hint?: string
}

/** Map a Tag kind to its fill color for the distribution bars. */
const KIND_FILL: Record<TagKind, string> = {
  blue: 'var(--blue-60)',
  green: 'var(--green-50)',
  red: 'var(--red-60)',
  gray: 'var(--gray-50)',
}

/**
 * HomePage — the operational console. Replaces the old marketing landing page
 * with a live dashboard backed by `GET /api/overview/summary`: headline KPI
 * tiles, an order-status distribution panel, and role-gated shortcut tiles.
 * Any authenticated role can load it (the summary endpoint is in the auth
 * group but enforces no specific role).
 */
export function HomePage() {
  const user = getCurrentUser()
  const roleId = user?.role_id ?? 0

  const [summary, setSummary] = useState<OverviewSummary | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<ApiError | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      // Summary is the primary payload; roles is a non-fatal side fetch used
      // only to resolve the current user's role name in the header.
      const [s, rs] = await Promise.all([
        overviewApi.summary(),
        fetchAll(rolesApi.selectAll).catch(() => [] as Role[]),
      ])
      setSummary(s)
      setRoles(rs)
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

  const visibleShortcuts = useMemo(
    () => SHORTCUTS.filter((s) => !s.roles || s.roles.includes(roleId)),
    [roleId],
  )

  // Derive the status distribution + KPI tiles from the summary. totalOrders
  // spans every non-deleted status so the proportional bars share one scale.
  const statusRows: StatusRow[] = summary
    ? [
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
    : []

  const totalOrders = statusRows.reduce((sum, r) => sum + r.count, 0)

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
            {/* KPI tiles — hairline grid, one highlighted to draw the eye. */}
            <div className={styles.kpis}>
              <KpiTile label="物品总数" value={summary.item_total} sub="全部在库物品" />
              <KpiTile
                label="库存不足"
                value={summary.low_inventory_count}
                sub="达到预警阈值"
                warn={summary.low_inventory_count > 0}
              />
              <KpiTile
                label="待审核订单"
                value={summary.pending_audit}
                sub={`进货 ${summary.purchase_requesting} · 出货 ${summary.outbound_requesting}`}
                highlight
              />
              <KpiTile label="待出入库" value={summary.audit_approved} sub="审核通过待处理" />
            </div>

            {/* Order status distribution */}
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>订单状态分布</h2>
                <span className={styles.panelMeta}>共 {totalOrders} 单</span>
              </div>
              {totalOrders === 0 ? (
                <p className={styles.muted}>暂无订单数据。</p>
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
            </div>

            {/* Quick navigation */}
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>快捷入口</h2>
              </div>
              <div className={styles.shortcuts}>
                {visibleShortcuts.map((s) => (
                  <Link key={s.to} to={s.to} className={styles.shortcut}>
                    <Tag kind={s.tagKind}>{s.tag}</Tag>
                    <h3 className={styles.shortcutTitle}>{s.label}</h3>
                    <p className={styles.shortcutDesc}>{s.desc}</p>
                    <span className={styles.shortcutArrow} aria-hidden>
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}

interface KpiTileProps {
  label: string
  value: number
  sub?: string
  highlight?: boolean
  warn?: boolean
}

function KpiTile({ label, value, sub, highlight, warn }: KpiTileProps) {
  return (
    <div
      className={[
        styles.kpi,
        highlight ? styles.kpiHighlight : '',
        warn && value > 0 ? styles.kpiWarn : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value.toLocaleString('zh-CN')}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  )
}

/** HH:mm (local) for the "updated at" caption. */
function formatClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
