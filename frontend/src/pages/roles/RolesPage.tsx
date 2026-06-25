import { useCallback, useEffect, useState } from 'react'
import { rolesApi } from '@/api/roles'
import { toApiError, type ApiError } from '@/api/errors'
import type { Role } from '@/types/role'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import { Pagination } from '@/components/ui/Pagination/Pagination'
import styles from './RolesPage.module.css'

type LoadState = 'loading' | 'error' | 'empty' | 'ready'

const PAGE_SIZE = 10

/**
 * Roles page — read-only list of the fixed role enum (POST /api/roles/selectAll,
 * paginated). Roles are seeded by migration (admin/purchaser/warehouse/auditor/
 * applicant); the backend exposes no create/update/delete, so this page is
 * view-only. Requires a valid JWT; backend enforces no specific role for reads.
 */
export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<ApiError | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async (targetPage = page) => {
    setState('loading')
    setError(null)
    try {
      const { list, total: t } = await rolesApi.selectAll({ page: targetPage, page_size: PAGE_SIZE })
      setRoles(list)
      setTotal(t)
      setPage(targetPage)
      setState(list.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      setError(toApiError(err))
      setState('error')
    }
  }, [page])

  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">角色管理</div>
            <h1 className={styles.title}>角色列表</h1>
          </div>
          <Button variant="tertiary" onClick={() => void load()} disabled={state === 'loading'}>
            {state === 'loading' ? '加载中…' : '刷新'}
          </Button>
        </div>

        {state === 'error' ? (
          <ErrorBanner
            error={error ?? toApiError(new Error('加载失败'))}
            prefix="无法加载角色数据"
            action={
              <Button variant="tertiary" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' ? (
          <p className={styles.muted}>正在加载角色数据…</p>
        ) : state === 'empty' ? (
          <p className={styles.muted}>暂无角色数据。</p>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>角色名称</th>
                    <th>角色代码</th>
                    <th>说明</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td className={styles.mono}>{r.id}</td>
                      <td>
                        <Tag kind={r.id === 1 ? 'blue' : 'gray'}>{r.name}</Tag>
                      </td>
                      <td className={styles.mono}>{r.code}</td>
                      <td className={styles.desc}>{r.description || '—'}</td>
                      <td className={styles.mono}>{formatTime(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              loading={false}
              onChange={(p) => void load(p)}
            />
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
  // YYYY-MM-DD HH:mm (local) — keep it terse for a table cell.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
