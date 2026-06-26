import { useEffect, useMemo, useState } from 'react'
import { getCurrentUser } from '@/api/auth'
import { usersApi } from '@/api/users'
import { rolesApi } from '@/api/roles'
import { departmentsApi } from '@/api/departments'
import { fetchAll } from '@/api/pagination'
import { toApiError, type ApiError } from '@/api/errors'
import type { Role } from '@/types/role'
import type { Department } from '@/types/department'
import { USER_STATUS } from '@/types/user'
import { ROLE_ID } from '@/types/role'
import { Tag } from '@/components/ui/Tag/Tag'
import { Button } from '@/components/ui/Button/Button'
import { TextInput } from '@/components/ui/TextInput/TextInput'
import { Modal } from '@/components/ui/Modal/Modal'
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
  const [pwdOpen, setPwdOpen] = useState(false)

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
                <Button
                  variant="secondary"
                  className={styles.pwdButton}
                  onClick={() => setPwdOpen(true)}
                >
                  修改密码
                </Button>
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

      <ChangePasswordModal open={pwdOpen} isAdmin={isAdmin} onClose={() => setPwdOpen(false)} />
    </section>
  )
}

/**
 * Self-service password change dialog. Wraps `POST /users/updateMyPassword`,
 * which any authenticated user may call to change their *own* password.
 * Non-admins must supply a correct old password (a wrong one yields 401 and is
 * surfaced on the old-password field); admins skip that check, so the field is
 * hidden for them. On success the form collapses to a confirmation state.
 *
 * The 401 from a wrong old password is a business error, not token expiry —
 * client.ts excludes this endpoint from the 401 auto-logout so we can show it
 * inline instead of bouncing the user to /login.
 */
function ChangePasswordModal({
  open,
  isAdmin,
  onClose,
}: {
  open: boolean
  isAdmin: boolean
  onClose: () => void
}) {
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [oldError, setOldError] = useState<string | null>(null)
  const [newError, setNewError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [formError, setFormError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Reset everything when the dialog is (re)opened.
  useEffect(() => {
    if (!open) return
    setOldPwd('')
    setNewPwd('')
    setConfirmPwd('')
    setOldError(null)
    setNewError(null)
    setConfirmError(null)
    setFormError(null)
    setSubmitting(false)
    setDone(false)
  }, [open])

  function close() {
    // Guard against discarding an in-flight submit.
    if (submitting) return
    onClose()
  }

  async function submit() {
    setOldError(null)
    setNewError(null)
    setConfirmError(null)
    setFormError(null)

    let valid = true
    if (!isAdmin && oldPwd.length === 0) {
      setOldError('请输入旧密码')
      valid = false
    }
    if (newPwd.length === 0) {
      setNewError('请输入新密码')
      valid = false
    }
    if (confirmPwd !== newPwd) {
      setConfirmError('两次输入的新密码不一致')
      valid = false
    }
    if (!valid) return

    setSubmitting(true)
    try {
      await usersApi.updateMyPassword(oldPwd, newPwd)
      setDone(true)
    } catch (err) {
      const apiErr = toApiError(err)
      // 401 here means the supplied old password was wrong (non-admin only).
      if (apiErr.status === 401) {
        setOldError('旧密码不正确')
      } else {
        setFormError(apiErr)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="修改密码"
      onClose={close}
      closeOnScrimClick={false}
      closeOnEscape={false}
      centered={done}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            完成
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={submitting}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void submit()} disabled={submitting}>
              {submitting ? '提交中…' : '保存'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className={styles.muted}>密码已成功更新。下次登录请使用新密码。</p>
      ) : (
        <>
          {!isAdmin && (
            <TextInput
              label="旧密码 *"
              type="password"
              reveal
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              error={oldError ?? undefined}
              placeholder="当前登录密码"
            />
          )}
          <TextInput
            label="新密码 *"
            type="password"
            reveal
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            error={newError ?? undefined}
            placeholder="新登录密码"
            helper="后端会使用 bcrypt 对密码进行哈希后存储。"
          />
          <TextInput
            label="确认新密码 *"
            type="password"
            reveal
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            error={confirmError ?? undefined}
            placeholder="再次输入新密码"
          />
          {formError && <ErrorBanner error={formError} prefix="修改失败" />}
        </>
      )}
    </Modal>
  )
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
