import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi } from '@/api/users'
import { rolesApi } from '@/api/roles'
import { departmentsApi } from '@/api/departments'
import { fetchAll } from '@/api/pagination'
import { ApiError, toApiError } from '@/api/errors'
import { getCurrentUser } from '@/api/auth'
import { usePagedList } from '@/hooks/usePagedList'
import type { User, UserInput } from '@/types/user'
import { USER_STATUS } from '@/types/user'
import type { Role } from '@/types/role'
import type { Department } from '@/types/department'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { TextInput } from '@/components/ui/TextInput/TextInput'
import { Select } from '@/components/ui/Select/Select'
import { Modal } from '@/components/ui/Modal/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import { Pagination } from '@/components/ui/Pagination/Pagination'
import styles from './UsersPage.module.css'

const PAGE_SIZE = 10

/**
 * Validates a phone number. Accepts:
 *   - China mobile: 11 digits starting with 1 (e.g. 13800138000)
 *   - Landline: optional area code (3-4 digits) + dash + 7-8 digits (e.g. 010-12345678)
 * Empty input is allowed (phone is optional) — callers decide.
 */
function isValidPhone(value: string): boolean {
  if (/^1\d{10}$/.test(value)) return true
  if (/^\d{3,4}-\d{7,8}$/.test(value)) return true
  return false
}

const emptyForm: UserInput = {
  username: '',
  password: '',
  real_name: '',
  phone: '',
  role_id: 0,
  department_id: null,
}

/** Edit-form state. `password` is optional — only sent when filled in. */
interface EditForm {
  username: string
  real_name: string
  phone: string
  role_id: number
  /** Editable via `POST /users/UpdateDepartmentById`. `null` = 无部门 (backend 0). */
  department_id: number | null
  password: string
}

/**
 * Users page — exercises the full user API surface:
 *   selectAll (paginated list), selectByUserName (single-user search), register
 *   (create), deleteById (remove), and the per-field Update*ById edits. Role/
 *   department pickers populate from /roles/selectAll and /departments/selectAll
 *   (fetched in full). Requires the Go backend running on :8080 and an admin JWT.
 * All failures surface as ApiError (HTTP code + short reason).
 */
export function UsersPage() {
  const navigate = useNavigate()
  const { rows: users, total, page, loading, error, reload, goToPage } = usePagedList<User>({
    loadPage: usersApi.selectAll,
    pageSize: PAGE_SIZE,
    searchMode: false,
  })

  // roles + departments for the pickers and table name resolution
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
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

  // search — searchError holds non-404 failures; 404 / empty result shows as "未找到"
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<User | null | undefined>(undefined)
  const [searchError, setSearchError] = useState<ApiError | null>(null)

  // transient action error (e.g. delete) shown inline below the toolbar
  const [actionError, setActionError] = useState<ApiError | null>(null)

  // destructive-action confirmation — native confirm replaced with a Carbon
  // ConfirmDialog. The pending slot covers block/unblock only; delete lives on
  // the user detail page's danger zone now.
  const [pending, setPending] = useState<{ kind: 'toggleBlock'; user: User } | null>(null)
  const [confirming, setConfirming] = useState(false)

  // create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<UserInput>(emptyForm)
  const [formError, setFormError] = useState<ApiError | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // edit modal
  const [editing, setEditing] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editError, setEditError] = useState<ApiError | null>(null)
  const [editPhoneError, setEditPhoneError] = useState<string | null>(null)

  // delete confirmation — triggered from the edit modal's footer
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Pickers + table name resolution — load once (full set). Non-fatal on
  // failure: selects stay empty and the table falls back to raw ids.
  useEffect(() => {
    void fetchAll(rolesApi.selectAll).then(setRoles).catch(() => undefined)
    void fetchAll(departmentsApi.selectAll).then(setDepartments).catch(() => undefined)
  }, [])

  const exitSearch = () => {
    setSearchResult(undefined)
    setSearchError(null)
    setSearchTerm('')
    reload()
  }

  const runSearch = async () => {
    const term = searchTerm.trim()
    if (!term) {
      exitSearch()
      return
    }
    setSearching(true)
    setSearchResult(undefined)
    setSearchError(null)
    try {
      const found = await usersApi.selectByUserName(term)
      setSearchResult(found)
    } catch (err) {
      const apiErr = toApiError(err)
      if (apiErr.status === 404) {
        // Not found is expected UX — show the friendly empty state, not an error.
        setSearchResult(null)
      } else {
        setSearchError(apiErr)
        setSearchResult(null)
      }
    } finally {
      setSearching(false)
    }
  }

  const handleToggleBlock = (user: User) => {
    const current = getCurrentUser()
    if (current?.id === user.id) {
      setActionError(
        new ApiError({
          code: 'BAD_REQUEST',
          status: null,
          reason: '请求参数有误',
          detail: '不能封禁/解封当前登录的账号',
        }),
      )
      return
    }
    setActionError(null)
    setPending({ kind: 'toggleBlock', user })
  }

  const confirmPending = async () => {
    if (!pending) return
    setConfirming(true)
    try {
      if (pending.user.status === USER_STATUS.DISABLED) {
        await usersApi.unblockById(pending.user.id)
      } else {
        await usersApi.blockById(pending.user.id)
      }
      if (searchResult?.id === pending.user.id) exitSearch()
      else reload()
      setPending(null)
    } catch (err) {
      setActionError(toApiError(err))
    } finally {
      setConfirming(false)
    }
  }

  const openCreate = () => {
    setForm({ ...emptyForm })
    setFormError(null)
    setPhoneError(null)
    setActionError(null)
    setCreateOpen(true)
  }

  const updateField = <K extends keyof UserInput>(key: K, value: UserInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'phone') {
      const v = (value as string).trim()
      setPhoneError(v && !isValidPhone(v) ? '电话格式不正确' : null)
    }
  }

  const submitCreate = async () => {
    if (!form.username.trim()) {
      setFormError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '用户名不能为空' }))
      return
    }
    if (!form.password.trim()) {
      setFormError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '密码不能为空' }))
      return
    }
    const phone = form.phone.trim()
    if (phone && !isValidPhone(phone)) {
      setPhoneError('电话格式不正确')
      setFormError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '电话格式不正确，请检查后重试' }))
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await usersApi.register({
        ...form,
        username: form.username.trim(),
        role_id: Number(form.role_id) || 0,
        department_id: form.department_id === null ? null : Number(form.department_id),
      })
      setCreateOpen(false)
      exitSearch()
    } catch (err) {
      setFormError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (user: User) => {
    setEditing(user)
    setEditForm({
      username: user.username,
      real_name: user.real_name ?? '',
      phone: user.phone ?? '',
      role_id: user.role_id,
      department_id: user.department_id || null,
      password: '',
    })
    setEditError(null)
    setEditPhoneError(null)
    setActionError(null)
  }

  const closeEdit = () => {
    setEditing(null)
    setEditForm(null)
    setEditError(null)
    setEditPhoneError(null)
  }

  // Delete from within the edit modal — confirm, then remove + close + reload.
  // Self-delete is blocked (an admin can't delete the account they're logged in as).
  const isEditingSelf = editing != null && getCurrentUser()?.id === editing.id

  const requestDelete = () => {
    if (!editing || isEditingSelf) return
    setActionError(null)
    setConfirmDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!editing) return
    setDeleting(true)
    try {
      await usersApi.deleteById(editing.id)
      setConfirmDeleteOpen(false)
      closeEdit()
      if (searchResult?.id === editing.id) exitSearch()
      else reload()
    } catch (err) {
      setActionError(toApiError(err))
      setConfirmDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const updateEditField = <K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    if (key === 'phone') {
      const v = (value as string).trim()
      setEditPhoneError(v && !isValidPhone(v) ? '电话格式不正确' : null)
    }
  }

  const submitEdit = async () => {
    if (!editing || !editForm) return
    if (!editForm.username.trim()) {
      setEditError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '用户名不能为空' }))
      return
    }
    const phone = editForm.phone.trim()
    if (phone && !isValidPhone(phone)) {
      setEditPhoneError('电话格式不正确')
      setEditError(new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '电话格式不正确，请检查后重试' }))
      return
    }

    setSubmitting(true)
    setEditError(null)
    try {
      const id = editing.id
      const nextUsername = editForm.username.trim()
      const nextRealName = editForm.real_name.trim()
      const nextPhone = editForm.phone.trim()
      const nextRoleId = Number(editForm.role_id) || 0
      const nextPassword = editForm.password

      // Only hit the per-field Update*ById endpoints whose value actually
      // changed. Backend department_id is a non-pointer int64 (0 = unassigned);
      // normalize 0 -> null to match the form's representation.
      if (nextUsername !== editing.username) {
        await usersApi.updateUserNameById(id, nextUsername)
      }
      if (nextRealName !== (editing.real_name ?? '')) {
        await usersApi.updateRealNameById(id, nextRealName)
      }
      if (nextPhone !== (editing.phone ?? '')) {
        await usersApi.updatePhoneById(id, nextPhone)
      }
      if (nextRoleId !== editing.role_id) {
        await usersApi.updateRoleById(id, nextRoleId)
      }
      const nextDepartmentId = editForm.department_id
      if (nextDepartmentId !== (editing.department_id || null)) {
        await usersApi.updateDepartmentById(id, nextDepartmentId ?? 0)
      }
      if (nextPassword.trim() !== '') {
        await usersApi.updatePasswordById(id, nextPassword)
      }
      closeEdit()
      if (searchResult?.id === id) exitSearch()
      else reload()
    } catch (err) {
      setEditError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const isSearchMode = searchResult !== undefined || searchError !== null

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">用户管理</div>
            <h1 className={styles.title}>用户列表</h1>
          </div>
          <div className={styles.actions}>
            <Button variant="primary" onClick={openCreate}>
              新增用户
            </Button>
            <Button variant="tertiary" onClick={reload} disabled={loading}>
              {loading ? '加载中…' : '刷新'}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/roles')}>
              角色管理
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="按用户名搜索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch()
            }}
          />
          <Button variant="secondary" onClick={() => void runSearch()} disabled={searching}>
            {searching ? '搜索中…' : '搜索'}
          </Button>
          {isSearchMode && (
            <Button variant="ghost" onClick={exitSearch}>
              返回列表
            </Button>
          )}
        </div>

        {/* Transient action error (e.g. delete failure) */}
        {actionError && (
          <div className={styles.actionErrorWrap}>
            <ErrorBanner error={actionError} prefix="操作失败" />
          </div>
        )}

        {/* Body */}
        {isSearchMode ? (
          searchError ? (
            <ErrorBanner error={searchError} prefix="搜索失败" />
          ) : searchResult ? (
            <UserTable
              users={[searchResult]}
              roleName={roleName}
              deptName={deptName}
              onEdit={openEdit}
              onToggleBlock={handleToggleBlock}
            />
          ) : (
            <p className={styles.muted}>未找到用户名为「{searchTerm}」的用户。</p>
          )
        ) : error ? (
          <ErrorBanner
            error={error}
            prefix="无法加载用户数据"
            action={
              <Button variant="tertiary" onClick={reload}>
                重试
              </Button>
            }
          />
        ) : loading ? (
          <p className={styles.muted}>正在加载用户数据…</p>
        ) : users.length === 0 ? (
          <p className={styles.muted}>暂无用户数据，点击「新增用户」创建。</p>
        ) : (
          <>
            <UserTable
              users={users}
              roleName={roleName}
              deptName={deptName}
              onEdit={openEdit}
              onToggleBlock={handleToggleBlock}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              loading={loading}
              onChange={goToPage}
            />
          </>
        )}
      </div>

      {/* Create modal — explicit-close only: clicking outside / Esc won't discard input */}
      <Modal
        open={createOpen}
        title="新增用户"
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
        <TextInput
          label="用户名 *"
          value={form.username}
          onChange={(e) => updateField('username', e.target.value)}
          placeholder="登录用户名"
        />
        <TextInput
          label="密码 *"
          type="password"
          reveal
          value={form.password}
          onChange={(e) => updateField('password', e.target.value)}
          placeholder="登录密码"
          helper="后端会使用 bcrypt 对密码进行哈希后存储。"
        />
        <div className={styles.row}>
          <TextInput
            label="姓名"
            value={form.real_name}
            onChange={(e) => updateField('real_name', e.target.value)}
            placeholder="真实姓名"
          />
          <TextInput
            label="电话"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="联系方式"
            error={phoneError ?? undefined}
            helper="手机号：11 位数字；座机：区号-号码"
          />
        </div>
        <div className={styles.row}>
          <Select
            label="角色 *"
            value={form.role_id === 0 ? '' : String(form.role_id)}
            onChange={(e) => updateField('role_id', e.target.value === '' ? 0 : Number(e.target.value))}
            options={[
              { value: '', label: '请选择角色' },
              ...roles.map((r) => ({ value: String(r.id), label: `${r.name}（#${r.id}）` })),
            ]}
            helper={roles.length === 0 ? '暂无角色可选。' : undefined}
          />
          <Select
            label="部门 *"
            value={form.department_id == null ? '' : String(form.department_id)}
            onChange={(e) =>
              updateField('department_id', e.target.value === '' ? null : Number(e.target.value))
            }
            options={[
              { value: '', label: '（无部门）' },
              ...departments.map((d) => ({ value: String(d.id), label: `${d.name}（#${d.id}）` })),
            ]}
            helper={departments.length === 0 ? '暂无部门可选。' : undefined}
          />
        </div>
        {formError && <ErrorBanner error={formError} prefix="创建失败" />}
      </Modal>

      {/* Edit modal — explicit-close only */}
      <Modal
        open={editing !== null}
        title={editing ? `编辑用户 · ${editing.username}` : '编辑用户'}
        onClose={closeEdit}
        closeOnScrimClick={false}
        closeOnEscape={false}
        footer={
          <>
            <Button
              variant="danger"
              style={{ marginRight: 'auto' }}
              onClick={requestDelete}
              disabled={submitting || deleting || isEditingSelf}
              title={isEditingSelf ? '不能删除当前登录的账号' : undefined}
            >
              删除
            </Button>
            <Button variant="ghost" onClick={closeEdit} disabled={submitting || deleting}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void submitEdit()} disabled={submitting || deleting}>
              {submitting ? '保存中…' : '保存'}
            </Button>
          </>
        }
      >
        {editForm && (
          <>
            <TextInput
              label="用户名 *"
              value={editForm.username}
              onChange={(e) => updateEditField('username', e.target.value)}
              placeholder="登录用户名"
            />
            <div className={styles.row}>
              <TextInput
                label="姓名"
                value={editForm.real_name}
                onChange={(e) => updateEditField('real_name', e.target.value)}
                placeholder="真实姓名"
              />
              <TextInput
                label="电话"
                value={editForm.phone}
                onChange={(e) => updateEditField('phone', e.target.value)}
                placeholder="联系方式"
                error={editPhoneError ?? undefined}
                helper="手机号：11 位数字；座机：区号-号码"
              />
            </div>
            <div className={styles.row}>
              <Select
                label="角色 *"
                value={editForm.role_id === 0 ? '' : String(editForm.role_id)}
                onChange={(e) =>
                  updateEditField('role_id', e.target.value === '' ? 0 : Number(e.target.value))
                }
                options={[
                  { value: '', label: '请选择角色' },
                  ...roles.map((r) => ({ value: String(r.id), label: `${r.name}（#${r.id}）` })),
                ]}
              />
              <Select
                label="部门 *"
                value={editForm.department_id == null ? '' : String(editForm.department_id)}
                onChange={(e) =>
                  updateEditField(
                    'department_id',
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
                options={[
                  { value: '', label: '（无部门）' },
                  ...departments.map((d) => ({ value: String(d.id), label: `${d.name}（#${d.id}）` })),
                ]}
                helper={departments.length === 0 ? '暂无部门可选。' : undefined}
              />
            </div>
            <TextInput
              label="新密码（可选）"
              type="password"
              reveal
              value={editForm.password}
              onChange={(e) => updateEditField('password', e.target.value)}
              placeholder="留空则不修改密码"
              helper="填写后将以 bcrypt 重新哈希存储。"
            />
            {editError && <ErrorBanner error={editError} prefix="保存失败" />}
          </>
        )}
      </Modal>

      {/* Block/unblock confirmation — delete lives in the edit modal */}
      <ConfirmDialog
        open={pending !== null}
        title={pending && pending.user.status === USER_STATUS.DISABLED ? '解封用户' : '封禁用户'}
        description={
          <>
            确认{pending && pending.user.status === USER_STATUS.DISABLED ? '解封' : '封禁'}用户{' '}
            <span className="confirmHighlight">「{pending?.user.real_name || pending?.user.username}」</span>
            （id={pending?.user.id}）？
            {pending && pending.user.status !== USER_STATUS.DISABLED && (
              <span className="confirmNote">封禁后该用户将无法登录系统。</span>
            )}
          </>
        }
        confirmLabel={pending && pending.user.status === USER_STATUS.DISABLED ? '解封' : '封禁'}
        tone={pending && pending.user.status !== USER_STATUS.DISABLED ? 'danger' : 'primary'}
        busy={confirming}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />

      {/* Delete confirmation — triggered from the edit modal */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="删除用户"
        description={
          <>
            确认删除用户{' '}
            <span className="confirmHighlight">「{editing?.real_name || editing?.username}」</span>
            （id={editing?.id}）？该操作不可撤销。
          </>
        }
        confirmLabel="删除"
        tone="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </section>
  )
}

interface UserTableProps {
  users: User[]
  roleName: Map<number, string>
  deptName: Map<number, string>
  onEdit: (user: User) => void
  onToggleBlock: (user: User) => void
}

function UserTable({ users, roleName, deptName, onEdit, onToggleBlock }: UserTableProps) {
  const navigate = useNavigate()
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>姓名</th>
            <th>电话</th>
            <th>角色</th>
            <th>部门</th>
            <th>状态</th>
            <th className={styles.actionCol}>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className={styles.mono}>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.real_name || '—'}</td>
              <td className={styles.mono}>{u.phone || '—'}</td>
              <td>{u.role_id ? roleName.get(u.role_id) ?? `#${u.role_id}` : '—'}</td>
              <td>{u.department_id ? deptName.get(u.department_id) ?? `#${u.department_id}` : '—'}</td>
              <td>
                {u.status === USER_STATUS.ACTIVE ? (
                  <Tag kind="green">正常</Tag>
                ) : (
                  <Tag kind="gray">禁用</Tag>
                )}
              </td>
              <td className={styles.actionCol}>
                <Button variant="ghost" onClick={() => navigate(`/users/${u.id}`)}>
                  详情
                </Button>
                <Button variant="ghost" onClick={() => onEdit(u)}>
                  编辑
                </Button>
                <Button
                  variant={u.status === USER_STATUS.DISABLED ? 'secondary' : 'ghost'}
                  onClick={() => onToggleBlock(u)}
                >
                  {u.status === USER_STATUS.DISABLED ? '启用' : '禁用'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
