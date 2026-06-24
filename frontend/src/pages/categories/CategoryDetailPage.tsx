import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { itemCategoriesApi } from '@/api/itemCategories'
import { fetchAll } from '@/api/pagination'
import { ApiError, toApiError } from '@/api/errors'
import type { ItemCategory } from '@/types/itemCategory'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './CategoryDetailPage.module.css'

type LoadState = 'loading' | 'error' | 'ready'

/**
 * Item-category detail page — dedicated route (`/categories/:id`). Mirrors the
 * department detail page (categories are also a tree via `parent`). Shows the
 * category record, its parent, its direct children, and a danger zone for
 * deletion (delete was moved off the list row). Delete is admin-gated.
 *
 * Route prefix is camelCase `/itemCategories` (not snake_case).
 */
export function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const categoryId = Number(id)

  const [category, setCategory] = useState<ItemCategory | null>(null)
  const [all, setAll] = useState<ItemCategory[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<ApiError | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      setError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '无效的分类 ID' }))
      setState('error')
      return
    }
    setState('loading')
    setError(null)
    try {
      const [cat, allCats] = await Promise.all([
        itemCategoriesApi.selectById(categoryId),
        fetchAll(itemCategoriesApi.selectAll),
      ])
      setCategory(cat)
      setAll(allCats)
      setState('ready')
    } catch (err) {
      setError(toApiError(err))
      setState('error')
    }
  }, [categoryId])

  useEffect(() => {
    void load()
  }, [load])

  const nameById = useMemo(() => {
    const m = new Map<number, string>()
    all.forEach((c) => m.set(c.id, c.name))
    return m
  }, [all])

  const parentName =
    category?.parent != null && category.parent > 0
      ? nameById.get(category.parent) ?? `#${category.parent}`
      : null

  const children = useMemo(
    () => all.filter((c) => c.parent === categoryId),
    [all, categoryId],
  )

  return (
    <section className="section">
      <div className="container">
        <div className={styles.topbar}>
          <Button variant="ghost" onClick={() => navigate('/categories')}>
            返回分类列表
          </Button>
        </div>

        {state === 'error' ? (
          <ErrorBanner
            error={error ?? toApiError(new Error('加载失败'))}
            prefix="无法加载分类详情"
            action={
              <Button variant="tertiary" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' || !category ? (
          <p className={styles.muted}>正在加载分类详情…</p>
        ) : (
          <>
            <div className={styles.header}>
              <div>
                <div className="section-label">分类详情</div>
                <h1 className={styles.title}>{category.name}</h1>
                <div className={styles.subtitle}>
                  <span className={styles.mono}>#{category.id}</span>
                  <Tag kind={parentName ? 'gray' : 'blue'}>
                    {parentName ? `上级：${parentName}` : '顶级分类'}
                  </Tag>
                  <span className={styles.muted}>创建于 {formatTime(category.created_at)}</span>
                </div>
              </div>
              <Button variant="tertiary" onClick={() => void load()}>
                刷新
              </Button>
            </div>

            {/* Basic info */}
            <div className={styles.detailCard}>
              <h2 className={styles.sectionTitle}>基本信息</h2>
              <dl className={styles.detailList}>
                <div className={styles.detailRow}>
                  <dt>名称</dt>
                  <dd>{category.name}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>说明</dt>
                  <dd>{category.description || '—'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>上级分类</dt>
                  <dd>{parentName ?? '—（顶级）'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>创建时间</dt>
                  <dd className={styles.mono}>{formatTime(category.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Direct children */}
            <div className={styles.childrenSection}>
              <h2 className={styles.sectionTitle}>直接子分类（{children.length}）</h2>
              {children.length === 0 ? (
                <p className={styles.muted}>该分类暂无子分类。</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>分类名称</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {children.map((c) => (
                        <tr key={c.id}>
                          <td className={styles.mono}>{c.id}</td>
                          <td>
                            <Tag kind="blue">{c.name}</Tag>
                          </td>
                          <td className={styles.desc}>{c.description || '—'}</td>
                        </tr>
                      ))}
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
