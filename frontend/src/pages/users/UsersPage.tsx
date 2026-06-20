import { useCallback, useEffect, useState } from 'react'
import { usersApi } from '@/api/users'
import type { User, UserInput } from '@/types/user'
import { USER_STATUS } from '@/types/user'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { TextInput } from '@/components/ui/TextInput/TextInput'
import { Modal } from '@/components/ui/Modal/Modal'
import styles from './UsersPage.module.css'

type LoadState = 'loading' | 'error' | 'empty' | 'ready'

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
  password_hash: '',
  real_name: '',
  phone: '',
  role_id: 0,
  department_id: null,
}

/**
 * Users page — exercises the full user API surface:
 *   selectAll (list), selectByUserName (search), deleteById (remove),
 *   insert (create). Requires the Go backend running on :8080.
 */
export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  // search
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<User | null | undefined>(undefined)

  // create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<UserInput>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadAll = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      const data = await usersApi.selectAll()
      setUsers(data)
      setState(data.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
      setState('error')
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const exitSearch = () => {
    setSearchResult(undefined)
    setSearchTerm('')
    void loadAll()
  }

  const runSearch = async () => {
    const term = searchTerm.trim()
    if (!term) {
      exitSearch()
      return
    }
    setSearching(true)
    setSearchResult(undefined)
    try {
      const found = await usersApi.selectByUserName(term)
      setSearchResult(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
      setSearchResult(null)
    } finally {
      setSearching(false)
    }
  }

  const handleDelete = async (user: User) => {
    if (!window.confirm(`确认删除用户「${user.real_name || user.username}」(id=${user.id})？`)) return
    try {
      await usersApi.deleteById(user.id)
      if (searchResult?.id === user.id) exitSearch()
      else void loadAll()
    } catch (err) {
      window.alert(`删除失败：${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(null)
    setPhoneError(null)
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
      setFormError('用户名不能为空')
      return
    }
    if (!form.password_hash.trim()) {
      setFormError('密码不能为空')
      return
    }
    const phone = form.phone.trim()
    if (phone && !isValidPhone(phone)) {
      setPhoneError('电话格式不正确')
      setFormError('电话格式不正确，请检查后重试')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await usersApi.insert({
        ...form,
        username: form.username.trim(),
        role_id: Number(form.role_id) || 0,
        department_id: form.department_id === null ? null : Number(form.department_id),
      })
      setCreateOpen(false)
      exitSearch()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const isSearchMode = searchResult !== undefined

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
            <Button variant="tertiary" onClick={() => void loadAll()} disabled={state === 'loading'}>
              {state === 'loading' ? '加载中…' : '刷新'}
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

        {/* Body */}
        {isSearchMode ? (
          searchResult ? (
            <UserTable users={[searchResult]} onDelete={handleDelete} />
          ) : (
            <p className={styles.muted}>未找到用户名为「{searchTerm}」的用户。</p>
          )
        ) : state === 'error' ? (
          <div className={styles.notice} role="alert">
            <Tag kind="red">错误</Tag>
            <span>无法加载用户数据：{error}</span>
          </div>
        ) : state === 'loading' ? (
          <p className={styles.muted}>正在加载用户数据…</p>
        ) : state === 'empty' ? (
          <p className={styles.muted}>暂无用户数据，点击「新增用户」创建。</p>
        ) : (
          <UserTable users={users} onDelete={handleDelete} />
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
          value={form.password_hash}
          onChange={(e) => updateField('password_hash', e.target.value)}
          placeholder="将作为 password_hash 存储"
          helper="注意：后端直接存储该值，未在服务端做哈希处理。"
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
          />
        </div>
        <div className={styles.row}>
          <TextInput
            label="角色 ID *"
            type="number"
            value={form.role_id === 0 ? '' : form.role_id}
            onChange={(e) => updateField('role_id', Number(e.target.value))}
            placeholder="role_id"
          />
          <TextInput
            label="部门 ID"
            type="number"
            value={form.department_id ?? ''}
            onChange={(e) =>
              updateField('department_id', e.target.value === '' ? null : Number(e.target.value))
            }
            placeholder="可选"
          />
        </div>
        {formError && (
          <div className={styles.formError} role="alert">
            <Tag kind="red">错误</Tag>
            <span>{formError}</span>
          </div>
        )}
      </Modal>
    </section>
  )
}

interface UserTableProps {
  users: User[]
  onDelete: (user: User) => void
}

function UserTable({ users, onDelete }: UserTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>姓名</th>
            <th>电话</th>
            <th>角色 ID</th>
            <th>部门 ID</th>
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
              <td className={styles.mono}>{u.role_id}</td>
              <td className={styles.mono}>{u.department_id ?? '—'}</td>
              <td>
                {u.status === USER_STATUS.ACTIVE ? (
                  <Tag kind="green">正常</Tag>
                ) : (
                  <Tag kind="gray">禁用</Tag>
                )}
              </td>
              <td className={styles.actionCol}>
                <Button variant="danger" onClick={() => onDelete(u)}>
                  删除
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
