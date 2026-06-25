import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { itemsApi } from '@/api/items'
import { warehousesApi } from '@/api/warehouses'
import { itemCategoriesApi } from '@/api/itemCategories'
import { fetchAll } from '@/api/pagination'
import { ApiError, toApiError } from '@/api/errors'
import type { Item } from '@/types/item'
import type { Warehouse } from '@/types/warehouse'
import type { ItemCategory } from '@/types/itemCategory'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './ItemDetailPage.module.css'

type LoadState = 'loading' | 'error' | 'ready'

/**
 * Item detail page — dedicated route (`/items/:id`). Shows the item's full
 * record, an inventory stat grid, and a danger zone for deletion (delete was
 * moved off the list row to avoid accidental destructive clicks). Reached
 * from the ItemsPage row "详情" button.
 *
 * Reads use the open `/items/selectById` (any authenticated role). Delete is
 * admin/warehouse/auditor-gated on the backend — the danger zone only renders
 * for those roles. Available stock = item_inventory - frozen_inventory (frozen
 * is held by audit-approved outbound orders); total value = available × price.
 */
export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const itemId = Number(id)

  const [item, setItem] = useState<Item | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<ApiError | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(itemId) || itemId <= 0) {
      setError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '无效的物品 ID' }))
      setState('error')
      return
    }
    setState('loading')
    setError(null)
    try {
      const [it, allWh, allCats] = await Promise.all([
        itemsApi.selectById(itemId),
        fetchAll(warehousesApi.selectAll).catch(() => [] as Warehouse[]),
        fetchAll(itemCategoriesApi.selectAll).catch(() => [] as ItemCategory[]),
      ])
      setItem(it)
      setWarehouses(allWh)
      setCategories(allCats)
      setState('ready')
    } catch (err) {
      setError(toApiError(err))
      setState('error')
    }
  }, [itemId])

  useEffect(() => {
    void load()
  }, [load])

  const warehouseName = (wid: number | null) =>
    wid != null ? warehouses.find((w) => w.id === wid)?.name ?? `#${wid}` : null
  const categoryName = (cid: number | null) =>
    cid != null ? categories.find((c) => c.id === cid)?.name ?? `#${cid}` : null

  const total = item?.item_inventory ?? 0
  const frozen = item?.frozen_inventory ?? 0
  const available = total - frozen
  const price = item?.price ?? null
  const value = price != null ? available * price : null
  const warningLevel = item?.warning_level ?? null
  const low = warningLevel != null && available <= warningLevel

  return (
    <section className="section">
      <div className="container">
        <div className={styles.topbar}>
          <Button variant="ghost" onClick={() => navigate('/items')}>
            返回物品列表
          </Button>
        </div>

        {state === 'error' ? (
          <ErrorBanner
            error={error ?? toApiError(new Error('加载失败'))}
            prefix="无法加载物品详情"
            action={
              <Button variant="tertiary" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' || !item ? (
          <p className={styles.muted}>正在加载物品详情…</p>
        ) : (
          <>
            <div className={styles.header}>
              <div>
                <div className="section-label">物品详情</div>
                <h1 className={styles.title}>{item.name}</h1>
                <div className={styles.subtitle}>
                  <span className={styles.mono}>#{item.id}</span>
                  {categoryName(item.category_id) && (
                    <Tag kind="blue">{categoryName(item.category_id)}</Tag>
                  )}
                  {warehouseName(item.warehouse_id) && (
                    <Tag kind="gray">{warehouseName(item.warehouse_id)}</Tag>
                  )}
                  <span className={styles.muted}>创建于 {formatTime(item.created_at)}</span>
                </div>
              </div>
              <Button variant="tertiary" onClick={() => void load()}>
                刷新
              </Button>
            </div>

            {/* Inventory stat tiles */}
            <div className={styles.stats}>
              <StatTile label="总库存" value={String(total)} />
              <StatTile label="冻结库存" value={String(frozen)} />
              <StatTile label="可用库存" value={String(available)} valueClass={low ? styles.statValueWarn : undefined} />
              <StatTile label="单价" value={price != null ? `¥${price}` : '—'} />
              <StatTile label="库存总值" value={value != null ? formatCurrency(value) : '—'} />
              <StatTile
                label="预警阈值"
                value={warningLevel != null ? String(warningLevel) : '—'}
                valueClass={low ? styles.statValueWarn : undefined}
              />
            </div>

            {/* Full record */}
            <div className={styles.detailCard}>
              <h2 className={styles.sectionTitle}>基本信息</h2>
              <dl className={styles.detailList}>
                <div className={styles.detailRow}>
                  <dt>名称</dt>
                  <dd>{item.name}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>分类</dt>
                  <dd>{categoryName(item.category_id) ?? '—'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>仓库</dt>
                  <dd>{warehouseName(item.warehouse_id) ?? '—'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>单价</dt>
                  <dd className={styles.mono}>{price != null ? `¥${price}` : '—'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>总库存</dt>
                  <dd className={styles.mono}>{total}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>冻结库存</dt>
                  <dd className={styles.mono}>{frozen}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>可用库存</dt>
                  <dd className={styles.mono}>
                    {available}
                    {low ? ' · 不足' : ''}
                  </dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>预警阈值</dt>
                  <dd>
                    {warningLevel != null ? (
                      <Tag kind={low ? 'red' : 'gray'}>{warningLevel}</Tag>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>创建时间</dt>
                  <dd className={styles.mono}>{formatTime(item.created_at)}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>更新时间</dt>
                  <dd className={styles.mono}>{formatTime(item.updated_at)}</dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function StatTile({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className={styles.statTile}>
      <div className={styles.statLabel}>{label}</div>
      <div className={[styles.statValue, valueClass].filter(Boolean).join(' ')}>{value}</div>
    </div>
  )
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
