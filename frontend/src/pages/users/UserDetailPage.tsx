import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usersApi } from '@/api/users'
import { rolesApi } from '@/api/roles'
import { departmentsApi } from '@/api/departments'
import { ApiError, toApiError } from '@/api/errors'
import { getCurrentUser } from '@/api/auth'
import type { User } from '@/types/user'
import { USER_STATUS } from '@/types/user'
import type { Role } from '@/types/role'
import type { Department } from '@/types/department'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './UserDetailPage.module.css'

type LoadState = 'loading' | 'error' | 'ready'

/**
 * User detail page — dedicated route (`/users/:id`). Shows a user's full
 * record (role/department resolved by name, status tag) and a danger zone for
 * deletion (delete was moved off the list row). Block/unblock stays on the
 * list page; only delete migrated here.
 *
 * The /users list is admin-only (nav hidden otherwise, and backend user reads
 * are admin-gated), so in practice only admins reach this page. Delete is
 * admin-gated regardless. Self-delete is blocked: an admin cannot delete the
 * account they are currently logged in as.
 */
export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const userId = Number(id)

  const current = getCurrentUser()

  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<ApiError | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '无效的用户 ID' }))
      setState('error')
      return
    }
    setState('loading')
    setError(null)
    try {
      const [u, allRoles, allDepts] = await Promise.all([
        usersApi.selectById(userId),
        rolesApi.selectAll().catch(() => [] as Role[]),
        departmentsApi.selectAll().catch(() => [] as Department[]),
      ])
      setUser(u)
      setRoles(allRoles)
      setDepartments(allDepts)
      setState('ready')
    } catch (err) {
      setError(toApiError(err))
      setState('error')
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

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

  const isSelf = current?.id != null && user?.id === current.id

  const displayName = user?.real_name || user?.username || '用户'

  return (
    <section className="section">
      <div className="container">
        <div className={styles.topbar}>
          <Button variant="ghost" onClick={() => navigate('/users')}>
            ← 返回用户列表
          </Button>
        </div>

        {state === 'error' ? (
          <ErrorBanner
            error={error ?? toApiError(new Error('加载失败'))}
            prefix="无法加载用户详情"
            action={
              <Button variant="tertiary" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' || !user ? (
          <p className={styles.muted}>正在加载用户详情…</p>
        ) : (
          <>
            <div className={styles.header}>
              <div>
                <div className="section-label">用户详情</div>
                <h1 className={styles.title}>{displayName}</h1>
                <div className={styles.subtitle}>
                  <span className={styles.mono}>#{user.id}</span>
                  <span className={styles.muted}>@{user.username}</span>
                  <Tag kind={user.status === USER_STATUS.ACTIVE ? 'green' : 'gray'}>
                    {user.status === USER_STATUS.ACTIVE ? '正常' : '禁用'}
                  </Tag>
                  {isSelf && <Tag kind="blue">当前账号</Tag>}
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
                  <dt>用户名</dt>
                  <dd className={styles.mono}>{user.username}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>姓名</dt>
                  <dd>{user.real_name || '—'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>电话</dt>
                  <dd className={styles.mono}>{user.phone || '—'}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>角色</dt>
                  <dd>{roleName.get(user.role_id) ?? `#${user.role_id}`}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>部门</dt>
                  <dd>
                    {user.department_id
                      ? deptName.get(user.department_id) ?? `#${user.department_id}`
                      : '—'}
                  </dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>状态</dt>
                  <dd>
                    <Tag kind={user.status === USER_STATUS.ACTIVE ? 'green' : 'gray'}>
                      {user.status === USER_STATUS.ACTIVE ? '正常' : '禁用'}
                    </Tag>
                  </dd>
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
