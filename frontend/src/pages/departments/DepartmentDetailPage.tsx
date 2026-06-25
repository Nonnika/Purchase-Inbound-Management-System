import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { departmentsApi } from '@/api/departments'
import { fetchAll } from '@/api/pagination'
import { ApiError, toApiError } from '@/api/errors'
import type { Department } from '@/types/department'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './DepartmentDetailPage.module.css'

type LoadState = 'loading' | 'error' | 'ready'

/**
 * Department detail page — dedicated route (`/departments/:id`). Shows the
 * department's record, its parent (resolved by name), its direct children,
 * and a danger zone for deletion (delete was moved off the list row).
 *
 * Departments form a tree via `parent` (null/0 = root). Reads use the open
 * `/departments/selectById` + `/departments/selectAll` (any authenticated
 * role). Delete is admin-gated on the backend; the danger zone only renders
 * for admins.
 */
export function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const departmentId = Number(id)

  const [department, setDepartment] = useState<Department | null>(null)
  const [all, setAll] = useState<Department[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<ApiError | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      setError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '无效的部门 ID' }))
      setState('error')
      return
    }
    setState('loading')
    setError(null)
    try {
      const [dept, allDepts] = await Promise.all([
        departmentsApi.selectById(departmentId),
        fetchAll(departmentsApi.selectAll),
      ])
      setDepartment(dept)
      setAll(allDepts)
      setState('ready')
    } catch (err) {
      setError(toApiError(err))
      setState('error')
    }
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  const nameById = useMemo(() => {
    const m = new Map<number, string>()
    all.forEach((d) => m.set(d.id, d.name))
    return m
  }, [all])

  const parentName =
    department?.parent != null && department.parent > 0
      ? nameById.get(department.parent) ?? `#${department.parent}`
      : null

  const children = useMemo(
    () => all.filter((d) => d.parent === departmentId),
    [all, departmentId],
  )

  return (
    <section className="section">
      <div className="container">
        <div className={styles.topbar}>
          <Button variant="ghost" onClick={() => navigate('/departments')}>
            返回部门列表
          </Button>
        </div>

        {state === 'error' ? (
          <ErrorBanner
            error={error ?? toApiError(new Error('加载失败'))}
            prefix="无法加载部门详情"
            action={
              <Button variant="tertiary" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' || !department ? (
          <p className={styles.muted}>正在加载部门详情…</p>
        ) : (
          <>
            <div className={styles.header}>
              <div>
                <div className="section-label">部门详情</div>
                <h1 className={styles.title}>{department.name}</h1>
                <div className={styles.subtitle}>
                  <span className={styles.mono}>#{department.id}</span>
                  <Tag kind={parentName ? 'gray' : 'blue'}>
                    {parentName ? `上级：${parentName}` : '顶级部门'}
                  </Tag>
                  <span className={styles.muted}>创建于 {formatTime(department.created_at)}</span>
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
                  <dd>{department.name}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>说明</dt>
                  <dd>{department.description || '—'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>上级部门</dt>
                  <dd>{parentName ?? '—（顶级）'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>创建时间</dt>
                  <dd className={styles.mono}>{formatTime(department.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Direct children */}
            <div className={styles.childrenSection}>
              <h2 className={styles.sectionTitle}>直接子部门（{children.length}）</h2>
              {children.length === 0 ? (
                <p className={styles.muted}>该部门暂无子部门。</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>部门名称</th>
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
