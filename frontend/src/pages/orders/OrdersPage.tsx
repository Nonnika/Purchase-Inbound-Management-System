import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ordersApi } from '@/api/orders'
import type { AppendEventInput } from '@/api/orders'
import { itemsApi } from '@/api/items'
import { fetchAll } from '@/api/pagination'
import { usePagedList } from '@/hooks/usePagedList'
import { ApiError, toApiError } from '@/api/errors'
import { getCurrentUser } from '@/api/auth'
import type { ChainVerifyResult, Order, OrderEvent } from '@/types/order'
import { ORDER_NEXT_STEPS, ORDER_STEP, ORDER_TYPE } from '@/types/order'
import type { Item } from '@/types/item'
import { ROLE_ID } from '@/types/role'
import { Button } from '@/components/ui/Button/Button'
import { Tag, type TagKind } from '@/components/ui/Tag/Tag'
import { TextInput } from '@/components/ui/TextInput/TextInput'
import { Select } from '@/components/ui/Select/Select'
import { Modal } from '@/components/ui/Modal/Modal'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import { Pagination } from '@/components/ui/Pagination/Pagination'
import styles from './OrdersPage.module.css'

const PAGE_SIZE = 10

interface StepAction {
  label: string
  kind: 'primary' | 'danger'
  roles: number[]
  run: (input: AppendEventInput) => Promise<OrderEvent>
}

/** Map each transitionable step to its API call + the roles allowed to perform it. */
const STEP_ACTIONS: Record<string, StepAction> = {
  [ORDER_STEP.AUDIT_APPROVED]: {
    label: '审核通过',
    kind: 'primary',
    roles: [ROLE_ID.ADMIN, ROLE_ID.AUDITOR],
    run: (i) => ordersApi.auditApprove(i),
  },
  [ORDER_STEP.AUDIT_REJECTED]: {
    label: '审核驳回',
    kind: 'danger',
    roles: [ROLE_ID.ADMIN, ROLE_ID.AUDITOR],
    run: (i) => ordersApi.auditReject(i),
  },
  [ORDER_STEP.WAREHOUSE_RECEIVED]: {
    label: '仓库收货',
    kind: 'primary',
    roles: [ROLE_ID.ADMIN, ROLE_ID.WAREHOUSE],
    run: (i) => ordersApi.warehouseReceive(i),
  },
  [ORDER_STEP.WAREHOUSE_SHIPPED]: {
    label: '仓库发货',
    kind: 'primary',
    roles: [ROLE_ID.ADMIN, ROLE_ID.WAREHOUSE],
    run: (i) => ordersApi.warehouseShip(i),
  },
}

const STATUS_META: Record<string, { label: string; kind: TagKind }> = {
  [ORDER_STEP.PURCHASE_REQUESTED]: { label: '采购申请中', kind: 'gray' },
  [ORDER_STEP.OUTBOUND_REQUESTED]: { label: '出库申请中', kind: 'gray' },
  [ORDER_STEP.AUDIT_APPROVED]: { label: '审核通过', kind: 'blue' },
  [ORDER_STEP.AUDIT_REJECTED]: { label: '已驳回', kind: 'red' },
  [ORDER_STEP.WAREHOUSE_RECEIVED]: { label: '已入库', kind: 'green' },
  [ORDER_STEP.WAREHOUSE_SHIPPED]: { label: '已出库', kind: 'green' },
}

const STEP_LABELS: Record<string, string> = {
  [ORDER_STEP.PURCHASE_REQUESTED]: '提交采购申请',
  [ORDER_STEP.OUTBOUND_REQUESTED]: '提交出库申请',
  [ORDER_STEP.AUDIT_APPROVED]: '审核通过',
  [ORDER_STEP.AUDIT_REJECTED]: '审核驳回',
  [ORDER_STEP.WAREHOUSE_RECEIVED]: '仓库收货',
  [ORDER_STEP.WAREHOUSE_SHIPPED]: '仓库发货',
}

type OrderTypeValue = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE]

interface CreateForm {
  type: OrderTypeValue
  itemId: number
  count: string
  note: string
}

const emptyCreateForm: CreateForm = {
  type: ORDER_TYPE.PURCHASE,
  itemId: 0,
  count: '',
  note: '',
}

/** No-op loader used when the current user can't call the all-orders endpoint. */
const noopLoad = async (): Promise<{ list: Order[]; total: number }> => ({ list: [], total: 0 })

/**
 * Orders page — the core procurement/inbound business flow. Orders form a
 * hash-chained event log across roles (purchaser/applicant → auditor →
 * warehouse). The list adapts to the current user's role:
 *   - viewers (admin/auditor/warehouse) see all orders via the paginated
 *     selectAll; with a type/status filter active it fetches every order so the
 *     filter matches across the whole set;
 *   - others (purchaser/applicant) see only their own via selectByUserId (a
 *     full, non-paginated list) and filter client-side.
 * Action buttons are gated by role AND by the order's current status (the
 * backend enforces the same transition rules).
 */
export function OrdersPage() {
  const user = getCurrentUser()
  const roleId = user?.role_id ?? 0
  const canViewAll = ([ROLE_ID.ADMIN, ROLE_ID.AUDITOR, ROLE_ID.WAREHOUSE] as number[]).includes(roleId)
  const canCreatePurchase = roleId === ROLE_ID.ADMIN || roleId === ROLE_ID.PURCHASER
  const canCreateOutbound = roleId === ROLE_ID.ADMIN || roleId === ROLE_ID.APPLICANT

  // filters
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const filtersActive = typeFilter !== 'ALL' || statusFilter !== 'ALL'

  // Viewer branch: server-paginated all-orders, with a search (fetch-all) mode
  // while a filter is active. Non-viewers get a no-op loader here and use the
  // own-orders path below.
  const paged = usePagedList<Order>({
    loadPage: canViewAll ? ordersApi.selectAll : noopLoad,
    pageSize: PAGE_SIZE,
    searchMode: canViewAll && filtersActive,
  })

  // Non-viewer branch: own orders via selectByUserId (full list, not paginated).
  const [ownOrders, setOwnOrders] = useState<Order[]>([])
  const [ownLoading, setOwnLoading] = useState(!canViewAll)
  const [ownError, setOwnError] = useState<ApiError | null>(null)

  const loadOwn = useCallback(async () => {
    setOwnLoading(true)
    setOwnError(null)
    try {
      const data = await ordersApi.selectByUserId(user?.id ?? 0)
      setOwnOrders(data)
    } catch (err) {
      setOwnError(toApiError(err))
    } finally {
      setOwnLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (canViewAll) return
    void loadOwn()
  }, [canViewAll, loadOwn])

  // items for name resolution + create-form picker (full set)
  const [items, setItems] = useState<Item[]>([])
  const itemsMap = useMemo(() => {
    const m = new Map<number, Item>()
    items.forEach((it) => m.set(it.id, it))
    return m
  }, [items])

  const loadItems = useCallback(async () => {
    try {
      const data = await fetchAll(itemsApi.selectAll)
      setItems(data)
    } catch {
      // Non-fatal: item picker just falls back to raw ids.
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  // Unified view state across both branches.
  const baseRows = canViewAll ? paged.rows : ownOrders
  const loading = canViewAll ? paged.loading : ownLoading
  const error = canViewAll ? paged.error : ownError
  const reload = canViewAll ? paged.reload : loadOwn
  const showPager = canViewAll && !filtersActive

  const filtered = useMemo(
    () =>
      baseRows.filter(
        (o) =>
          (typeFilter === 'ALL' || o.order_type === typeFilter) &&
          (statusFilter === 'ALL' || o.status === statusFilter),
      ),
    [baseRows, typeFilter, statusFilter],
  )

  // create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [createError, setCreateError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // detail modal
  const [selected, setSelected] = useState<Order | null>(null)
  const [events, setEvents] = useState<OrderEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<ApiError | null>(null)
  const [chain, setChain] = useState<ChainVerifyResult | null>(null)

  // action modal (note prompt for a transition)
  const [pendingStep, setPendingStep] = useState<string | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [actionModalError, setActionModalError] = useState<ApiError | null>(null)
  const [actionError, setActionError] = useState<ApiError | null>(null)

  // Load the event chain + verification whenever an order is opened.
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setEvents([])
    setEventsError(null)
    setChain(null)
    setEventsLoading(true)
    Promise.all([ordersApi.events(selected.id), ordersApi.verifyChain(selected.id)])
      .then(([evs, ver]) => {
        if (cancelled) return
        setEvents(evs)
        setChain(ver)
      })
      .catch((err) => {
        if (cancelled) return
        setEventsError(toApiError(err))
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  const openCreate = () => {
    // Default to whichever type this user is allowed to create.
    const defaultType = canCreatePurchase ? ORDER_TYPE.PURCHASE : ORDER_TYPE.OUTBOUND
    setCreateForm({ ...emptyCreateForm, type: defaultType })
    setCreateError(null)
    setActionError(null)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!createForm.itemId) {
      setCreateError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '请选择物品' }),
      )
      return
    }
    const count = Number(createForm.count)
    if (!Number.isFinite(count) || count <= 0) {
      setCreateError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '数量必须为正整数' }),
      )
      return
    }
    setSubmitting(true)
    setCreateError(null)
    try {
      // user_id 0 → backend defaults to the current user (and forbids non-admins
      // from impersonating another user).
      if (createForm.type === ORDER_TYPE.PURCHASE) {
        await ordersApi.createPurchaseRequest({
          item_id: createForm.itemId,
          user_id: 0,
          count,
          note: createForm.note,
        })
      } else {
        await ordersApi.createOutboundRequest({
          item_id: createForm.itemId,
          user_id: 0,
          count,
          note: createForm.note,
        })
      }
      setCreateOpen(false)
      reload()
    } catch (err) {
      setCreateError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const beginAction = (step: string) => {
    setPendingStep(step)
    setActionNote('')
    setActionModalError(null)
  }

  const confirmAction = async () => {
    if (!selected || !pendingStep) return
    const action = STEP_ACTIONS[pendingStep]
    if (!action) return
    setSubmitting(true)
    setActionModalError(null)
    try {
      await action.run({ order_id: selected.id, note: actionNote })
      setPendingStep(null)
      // Refresh the open order + chain + list.
      const [refreshed, evs, ver] = await Promise.all([
        ordersApi.selectById(selected.id),
        ordersApi.events(selected.id),
        ordersApi.verifyChain(selected.id),
      ])
      setSelected(refreshed)
      setEvents(evs)
      setChain(ver)
      reload()
    } catch (err) {
      setActionModalError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // Actionable transitions for the selected order (role + status gated).
  const availableActions = useMemo<{ step: string; action: StepAction }[]>(() => {
    if (!selected) return []
    const next = ORDER_NEXT_STEPS[selected.order_type]?.[selected.status] ?? []
    return next
      .map((step) => ({ step, action: STEP_ACTIONS[step] }))
      .filter((a): a is { step: string; action: StepAction } => !!a.action && a.action.roles.includes(roleId))
  }, [selected, roleId])

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">订单管理</div>
            <h1 className={styles.title}>订单列表</h1>
          </div>
          <div className={styles.actions}>
            {(canCreatePurchase || canCreateOutbound) && (
              <Button variant="primary" onClick={openCreate}>
                新建订单
              </Button>
            )}
            <Button variant="tertiary" onClick={reload} disabled={loading}>
              {loading ? '加载中…' : '刷新'}
            </Button>
          </div>
        </div>

        {/* Filters — for viewers these switch to fetch-all mode so the filter
            matches across every order; for non-viewers they filter the already-
            full own-orders list client-side. */}
        <div className={styles.filters}>
          <Select
            className={styles.filterField}
            label="订单类型"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: 'ALL', label: '全部' },
              { value: ORDER_TYPE.PURCHASE, label: '进货' },
              { value: ORDER_TYPE.OUTBOUND, label: '出货' },
            ]}
          />
          <Select
            className={styles.filterField}
            label="状态"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'ALL', label: '全部' },
              ...Object.entries(STATUS_META).map(([step, meta]) => ({
                value: step,
                label: meta.label,
              })),
            ]}
          />
        </div>

        {actionError && (
          <div className={styles.actionErrorWrap}>
            <ErrorBanner error={actionError} prefix="操作失败" />
          </div>
        )}

        {error ? (
          <ErrorBanner
            error={error}
            prefix="无法加载订单数据"
            action={
              <Button variant="tertiary" onClick={reload}>
                重试
              </Button>
            }
          />
        ) : loading ? (
          <p className={styles.muted}>正在加载订单数据…</p>
        ) : filtered.length === 0 ? (
          <p className={styles.muted}>
            {baseRows.length === 0 ? '暂无订单数据。' : '没有符合筛选条件的订单。'}
          </p>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>物品</th>
                    <th>数量</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>申请人</th>
                    <th>创建时间</th>
                    <th className={styles.actionCol}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const meta = STATUS_META[o.status] ?? { label: o.status, kind: 'gray' as TagKind }
                    return (
                      <tr key={o.id} onClick={() => setSelected(o)}>
                        <td className={styles.mono}>{o.id}</td>
                        <td>{itemsMap.get(o.item_id)?.name ?? `#${o.item_id}`}</td>
                        <td className={styles.mono}>{o.count}</td>
                        <td>{o.order_type === ORDER_TYPE.PURCHASE ? '进货' : '出货'}</td>
                        <td>
                          <Tag kind={meta.kind}>{meta.label}</Tag>
                        </td>
                        <td className={styles.mono}>#{o.user_id}</td>
                        <td className={styles.mono}>{formatTime(o.created_at)}</td>
                        <td className={styles.actionCol}>
                          <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(o) }}>
                            详情
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {showPager && (
              <Pagination
                page={paged.page}
                pageSize={PAGE_SIZE}
                total={paged.total}
                loading={loading}
                onChange={paged.goToPage}
              />
            )}
          </>
        )}
      </div>

      {/* Create modal — explicit-close only */}
      <Modal
        open={createOpen}
        title="新建订单"
        onClose={() => setCreateOpen(false)}
        closeOnScrimClick={false}
        closeOnEscape={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void submitCreate()} disabled={submitting}>
              {submitting ? '提交中…' : '创建'}
            </Button>
          </>
        }
      >
        <Select
          label="订单类型"
          value={createForm.type}
          onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value as OrderTypeValue }))}
          options={[
            ...(canCreatePurchase ? [{ value: ORDER_TYPE.PURCHASE, label: '进货（采购申请）' }] : []),
            ...(canCreateOutbound ? [{ value: ORDER_TYPE.OUTBOUND, label: '出货（出库申请）' }] : []),
          ]}
        />
        <Select
          label="物品"
          value={createForm.itemId === 0 ? '' : String(createForm.itemId)}
          onChange={(e) =>
            setCreateForm((f) => ({ ...f, itemId: e.target.value === '' ? 0 : Number(e.target.value) }))
          }
          options={[
            { value: '', label: '请选择物品' },
            ...items.map((it) => ({ value: String(it.id), label: `${it.name}（#${it.id}）` })),
          ]}
          helper={items.length === 0 ? '暂无可选物品，请先在系统中创建物品。' : undefined}
        />
        <TextInput
          label="数量 *"
          type="number"
          value={createForm.count}
          onChange={(e) => setCreateForm((f) => ({ ...f, count: e.target.value }))}
          placeholder="正整数"
        />
        <TextInput
          label="备注（可选）"
          value={createForm.note}
          onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="随本次申请记录的备注"
        />
        {createError && <ErrorBanner error={createError} prefix="创建失败" />}
      </Modal>

      {/* Detail modal */}
      <Modal
        open={selected !== null}
        title={selected ? `订单详情 · #${selected.id}` : '订单详情'}
        onClose={() => setSelected(null)}
        footer={
          <Button variant="ghost" onClick={() => setSelected(null)}>
            关闭
          </Button>
        }
      >
        {selected && (
          <>
            <div className={styles.detailGrid}>
              <DetailItem label="订单 ID" value={`#${selected.id}`} mono />
              <DetailItem label="状态" value={<StatusTag status={selected.status} />} />
              <DetailItem
                label="物品"
                value={itemsMap.get(selected.item_id)?.name ?? `#${selected.item_id}`}
              />
              <DetailItem label="数量" value={String(selected.count)} mono />
              <DetailItem
                label="类型"
                value={selected.order_type === ORDER_TYPE.PURCHASE ? '进货' : '出货'}
              />
              <DetailItem label="申请人" value={`#${selected.user_id}`} mono />
              <DetailItem label="创建时间" value={formatTime(selected.created_at)} mono />
              <DetailItem label="更新时间" value={formatTime(selected.updated_at)} mono />
            </div>

            <div className={styles.sectionHeading}>
              事件链
              {chain && (
                <span
                  className={[
                    styles.chainBadge,
                    chain.valid ? styles.chainOk : styles.chainFail,
                  ].join(' ')}
                  title={chain.error || undefined}
                >
                  {chain.valid ? '链校验通过' : '链校验失败'}
                </span>
              )}
            </div>

            {eventsError ? (
              <ErrorBanner error={eventsError} prefix="无法加载事件链" />
            ) : eventsLoading ? (
              <p className={styles.muted}>正在加载事件链…</p>
            ) : events.length === 0 ? (
              <p className={styles.muted}>暂无事件记录。</p>
            ) : (
              <div className={styles.timeline}>
                {events.map((ev) => (
                  <div key={ev.id} className={styles.event}>
                    <div className={styles.eventHead}>
                      <Tag kind="gray">{STEP_LABELS[ev.step] ?? ev.step}</Tag>
                      <span className={styles.eventMeta}>
                        #{ev.sequence_no}
                        {ev.operator_user_id != null ? ` · 操作人 #${ev.operator_user_id}` : ''}
                        {` · ${formatTime(ev.created_at)}`}
                      </span>
                    </div>
                    <div className={styles.eventHash}>hash: {truncate(ev.event_hash, 24)}</div>
                    {hasPayload(ev.event_payload) && (
                      <div className={styles.eventPayload}>
                        {formatPayload(ev.event_payload)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Role + status gated transition actions */}
            {availableActions.length > 0 ? (
              <div className={styles.detailActions}>
                {availableActions.map(({ step, action }) => (
                  <Button key={step} variant={action.kind} onClick={() => beginAction(step)}>
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className={styles.terminalNote}>
                {isTerminal(selected)
                  ? '该订单已结束，无后续操作。'
                  : '当前状态下你没有可执行的操作。'}
              </p>
            )}
          </>
        )}
      </Modal>

      {/* Action note modal — explicit-close only */}
      <Modal
        open={pendingStep !== null}
        title={pendingStep ? STEP_ACTIONS[pendingStep]?.label ?? '操作' : '操作'}
        onClose={() => setPendingStep(null)}
        closeOnScrimClick={false}
        closeOnEscape={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingStep(null)} disabled={submitting}>
              取消
            </Button>
            <Button
              variant={pendingStep ? STEP_ACTIONS[pendingStep]?.kind ?? 'primary' : 'primary'}
              onClick={() => void confirmAction()}
              disabled={submitting}
            >
              {submitting ? '处理中…' : '确认'}
            </Button>
          </>
        }
      >
        <p className={styles.muted}>
          确认对订单 #{selected?.id} 执行「{pendingStep ? STEP_ACTIONS[pendingStep]?.label : ''}」操作。
        </p>
        <TextInput
          label="备注（可选）"
          value={actionNote}
          onChange={(e) => setActionNote(e.target.value)}
          placeholder="随本次操作记录的备注"
        />
        {actionModalError && <ErrorBanner error={actionModalError} prefix="操作失败" />}
      </Modal>
    </section>
  )
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className={styles.detailItem}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={[styles.detailValue, mono ? styles.mono : ''].filter(Boolean).join(' ')}>
        {value}
      </span>
    </div>
  )
}

function StatusTag({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, kind: 'gray' as TagKind }
  return <Tag kind={meta.kind}>{meta.label}</Tag>
}

/** A status with no further valid transitions is terminal. */
function isTerminal(order: Order): boolean {
  const next = ORDER_NEXT_STEPS[order.order_type]?.[order.status]
  return !next || next.length === 0
}

function hasPayload(payload: unknown): boolean {
  if (payload == null) return false
  if (typeof payload === 'object') return Object.keys(payload as object).length > 0
  return String(payload).trim() !== ''
}

function formatPayload(payload: unknown): string {
  if (payload == null) return ''
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
