import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { warehousesApi } from '@/api/warehouses'
import { itemsApi } from '@/api/items'
import { itemCategoriesApi } from '@/api/itemCategories'
import { fetchAll } from '@/api/pagination'
import { ApiError, toApiError } from '@/api/errors'
import type { Warehouse } from '@/types/warehouse'
import type { Item } from '@/types/item'
import type { ItemCategory } from '@/types/itemCategory'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './WarehouseDetailPage.module.css'

type LoadState = 'loading' | 'error' | 'empty' | 'ready'

/**
 * Warehouse detail page — a dedicated route (`/warehouses/:id`) showing the
 * warehouse's stored items plus aggregate inventory stats. Reached from the
 * WarehousesPage row "详情" button.
 *
 * The backend has no per-warehouse items endpoint, so items are fetched via
 * /items/selectAll (open to any authenticated role) and filtered client-side
 * by warehouse_id. Available stock = item_inventory - frozen_inventory
 * (frozen is held by audit-approved outbound orders — same definition as
 * ItemsPage). Total value = Σ(available × price) over priced items.
 */
export function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const warehouseId = Number(id)

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<ItemCategory[]>([])
  // Total item count across ALL warehouses — used for the cargo share stat.
  const [allItemCount, setAllItemCount] = useState(0)
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<ApiError | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(warehouseId) || warehouseId <= 0) {
      setError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '无效的仓库 ID' }))
      setState('error')
      return
    }
    setState('loading')
    setError(null)
    try {
      // Warehouse via selectAll + match (no admin-gated selectById needed);
      // items + categories via their open reads. All resolve together.
      const [allWarehouses, allItems, allCats] = await Promise.all([
        fetchAll(warehousesApi.selectAll),
        fetchAll(itemsApi.selectAll),
        fetchAll(itemCategoriesApi.selectAll).catch(() => [] as ItemCategory[]),
      ])
      const wh = allWarehouses.find((w) => w.id === warehouseId) ?? null
      setWarehouse(wh)
      setCategories(allCats)
      setAllItemCount(allItems.length)
      if (!wh) {
        setError(new ApiError({ code: 'NOT_FOUND', status: 404, reason: '资源不存在', detail: '仓库不存在' }))
        setState('error')
        return
      }
      const owned = allItems.filter((it) => it.warehouse_id === warehouseId)
      setItems(owned)
      setState(owned.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      setError(toApiError(err))
      setState('error')
    }
  }, [warehouseId])

  useEffect(() => {
    void load()
  }, [load])

  const categoryName = useMemo(() => {
    const m = new Map<number, string>()
    categories.forEach((c) => m.set(c.id, c.name))
    return m
  }, [categories])

  // Aggregate stats. totalValue counts only items with a price set.
  // cargoShare = this warehouse's item-kind count as a fraction of all items
  // across every warehouse (0..1); 0 when there are no items anywhere.
  const stats = useMemo(() => {
    let totalInventory = 0
    let totalFrozen = 0
    let totalValue = 0
    let lowCount = 0
    items.forEach((it) => {
      const total = it.item_inventory ?? 0
      const frozen = it.frozen_inventory ?? 0
      const available = total - frozen
      totalInventory += total
      totalFrozen += frozen
      if (it.price != null) totalValue += available * it.price
      if (it.warning_level != null && available <= it.warning_level) lowCount += 1
    })
    const cargoShare = allItemCount > 0 ? items.length / allItemCount : 0
    return { totalInventory, totalFrozen, totalValue, lowCount, cargoShare }
  }, [items, allItemCount])

  const availableTotal = stats.totalInventory - stats.totalFrozen

  return (
    <section className="section">
      <div className="container">
        <div className={styles.topbar}>
          <Button variant="ghost" onClick={() => navigate('/warehouses')}>
            返回仓库列表
          </Button>
        </div>

        <div className={styles.header}>
          <div>
            <div className="section-label">仓库详情</div>
            <h1 className={styles.title}>{warehouse?.name ?? '仓库详情'}</h1>
            {warehouse && (
              <div className={styles.subtitle}>
                <span className={styles.mono}>#{warehouse.id}</span>
                {warehouse.description && <span className={styles.descText}>{warehouse.description}</span>}
                {warehouse.description && <span className={styles.muted}>创建于 {formatTime(warehouse.create_at)}</span>}
              </div>
            )}
          </div>
          <Button variant="tertiary" onClick={() => void load()} disabled={state === 'loading'}>
            {state === 'loading' ? '加载中…' : '刷新'}
          </Button>
        </div>

        {state === 'error' ? (
          <ErrorBanner
            error={error ?? toApiError(new Error('加载失败'))}
            prefix="无法加载仓库详情"
            action={
              <Button variant="tertiary" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' ? (
          <p className={styles.muted}>正在加载仓库详情…</p>
        ) : (
          <>
            {/* Inventory total value — full-width highlight tile, above the grid */}
            <div className={`${styles.statTile} ${styles.statTileHighlight} ${styles.valueTile}`}>
              <div className={styles.statLabel}>库存总值</div>
              <div className={styles.valueTileFigure}>{formatCurrency(stats.totalValue)}</div>
            </div>

            {/* Summary stat tiles */}
            <div className={styles.stats}>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>物品种类</div>
                <div className={styles.statValue}>{items.length}</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>总库存</div>
                <div className={styles.statValue}>{stats.totalInventory}</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>冻结库存</div>
                <div className={styles.statValue}>{stats.totalFrozen}</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>可用库存</div>
                <div className={styles.statValue}>{availableTotal}</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>货物占比</div>
                <div className={styles.statValue}>{formatPercent(stats.cargoShare)}</div>
                <div className={styles.statSub}>
                  {items.length} / {allItemCount} 种物品
                </div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>库存不足</div>
                <div
                  className={[
                    styles.statValue,
                    stats.lowCount > 0 ? styles.statValueWarn : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {stats.lowCount}
                </div>
              </div>
            </div>

            {/* Stored items */}
            <div className={styles.itemsSection}>
              <h2 className={styles.sectionTitle}>存储物品</h2>
              {state === 'empty' ? (
                <p className={styles.muted}>该仓库暂无存储物品。</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>物品名称</th>
                        <th>分类</th>
                        <th>单价</th>
                        <th>总库存</th>
                        <th>冻结</th>
                        <th>可用库存</th>
                        <th>预警阈值</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const total = it.item_inventory ?? 0
                        const frozen = it.frozen_inventory ?? 0
                        const available = total - frozen
                        const low = it.warning_level != null && available <= it.warning_level
                        return (
                          <tr key={it.id}>
                            <td className={styles.mono}>{it.id}</td>
                            <td>{it.name}</td>
                            <td>
                              {it.category_id != null
                                ? categoryName.get(it.category_id) ?? `#${it.category_id}`
                                : '—'}
                            </td>
                            <td className={styles.mono}>
                              {it.price != null ? `¥${it.price}` : '—'}
                            </td>
                            <td className={styles.mono}>{total}</td>
                            <td className={styles.mono}>{frozen}</td>
                            <td
                              className={[styles.mono, low ? styles.invLow : '']
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {available}
                              {low ? ' · 不足' : ''}
                            </td>
                            <td className={styles.mono}>
                              {it.warning_level != null ? (
                                <Tag kind={low ? 'red' : 'gray'}>{it.warning_level}</Tag>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Format a monetary total with thousands separators, e.g. 12345.6 -> ¥12,345.60. */
function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Format a 0..1 fraction as a percentage, e.g. 0.1234 -> 12.34%. */
function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—'
  return `${(fraction * 100).toFixed(2)}%`
}
