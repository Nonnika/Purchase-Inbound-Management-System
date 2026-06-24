import { useEffect, useMemo, useState } from 'react'
import { getCurrentUser } from '@/api/auth'
import { rolesApi } from '@/api/roles'
import { departmentsApi } from '@/api/departments'
import { fetchAll } from '@/api/pagination'
import { toApiError, type ApiError } from '@/api/errors'
import type { Role } from '@/types/role'
import type { Department } from '@/types/department'
import { USER_STATUS } from '@/types/user'
import { ROLE_ID } from '@/types/role'
import { Tag } from '@/components/ui/Tag/Tag'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './ProfilePage.module.css'

type LoadState = 'loading' | 'ready'

/**
 * Personal profile page — shows the current logged-in user's basic info.
 *
 * The user record itself comes from `getCurrentUser()` (the object stashed in
 * localStorage at login from POST /users/verify), so this page needs no
 * admin-gated user endpoint — every role can view their own profile. Role and
 * department are resolved to display names via the open /roles and /departments
 * reads; both are non-fatal (fall back to the raw id) so a permissions read
 * failure never blocks the page.
 *
 * Reached by clicking the username in the masthead (AppLayout session block).
 */
export function ProfilePage() {
  const user = getCurrentUser()
  const [state, setState] = useState<LoadState>('loading')
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [error, setError] = useState<ApiError | null>(null)

  // Resolve role + department display names. Both reads are open to any
  // authenticated token on the backend; a failure just leaves the maps empty
  // and we fall back to the raw ids.
  useEffect(() => {
    let alive = true
    setError(null)
    Promise.all([
      fetchAll(rolesApi.selectAll).catch((e) => {
        // Non-fatal, but surface it so an admin knows why names are missing.
        if (alive) setError(toApiError(e))
        return [] as Role[]
      }),
      fetchAll(departmentsApi.selectAll).catch(() => [] as Department[]),
    ]).then(([r, d]) => {
      if (!alive) return
      setRoles(r)
      setDepartments(d)
      setState('ready')
    })
    return () => {
      alive = false
    }
  }, [])

  const roleName = useMemo(() => {
    const m = new Map<number, string>()
    roles.forEach((r) => m.set(r.id, r.name))
    return m
  }, [roles])
  const deptName = useMemo(() => {
    const m = new Map<number, string>()
    departments.forEach((d) => m.set(d.id, d.name))
    return m
  }, [departments])

  if (!user) {
    return (
      <section className="section">
        <div className="container">
          <ErrorBanner
            error={toApiError(new Error('未登录'))}
            prefix="无法读取用户信息"
          />
        </div>
      </section>
    )
  }

  const isActive = user.status === USER_STATUS.ACTIVE
  const isAdmin = user.role_id === ROLE_ID.ADMIN
  const displayName = user.real_name || user.username

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div className="section-label">个人主页</div>
          <h1 className={styles.title}>{displayName}</h1>
        </div>

        {state === 'loading' ? (
          <p className={styles.muted}>正在加载用户信息…</p>
        ) : (
          <div className={styles.card}>
            <div className={styles.cardBody}>
              {/* Identity sidebar — avatar + headline + tags */}
              <aside className={styles.identity}>
                <span className={styles.avatar} aria-hidden="true">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <div className={styles.displayName}>{displayName}</div>
                <div className={styles.username}>@{user.username}</div>
                <div className={styles.tags}>
                  <Tag kind="blue">{roleName.get(user.role_id) ?? `角色 #${user.role_id}`}</Tag>
                  <Tag kind={isActive ? 'green' : 'red'}>
                    {isActive ? '正常' : '已禁用'}
                  </Tag>
                  {isAdmin && <Tag kind="gray">管理员</Tag>}
                </div>
              </aside>

              {/* Detail grid — fills the remaining card width */}
              <dl className={styles.detailList}>
                <div className={styles.detailRow}>
                  <dt>用户 ID</dt>
                  <dd className={styles.mono}>{user.id}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>用户名</dt>
                  <dd className={styles.mono}>{user.username}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>姓名</dt>
                  <dd>{user.real_name || '—'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>联系电话</dt>
                  <dd className={styles.mono}>{user.phone || '—'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>角色</dt>
                  <dd>{roleName.get(user.role_id) ?? `#${user.role_id}`}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>所属部门</dt>
                  <dd>
                    {user.department_id
                      ? deptName.get(user.department_id) ?? `#${user.department_id}`
                      : '—'}
                  </dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>账号状态</dt>
                  <dd>{isActive ? '正常' : '已禁用'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>创建时间</dt>
                  <dd className={styles.mono}>{formatTime(user.created_at)}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>更新时间</dt>
                  <dd className={styles.mono}>{formatTime(user.updated_at)}</dd>
                </div>
              </dl>
            </div>

            {error && (
              <div className={styles.errorWrap}>
                <ErrorBanner error={error} prefix="部分信息加载失败" />
              </div>
            )}
          </div>
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
