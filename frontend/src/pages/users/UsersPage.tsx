import { useCallback, useEffect, useState } from 'react'
import { usersApi } from '@/api/users'
import type { User } from '@/types/user'
import { USER_STATUS } from '@/types/user'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import styles from './UsersPage.module.css'

/**
 * Users page — exercises the live backend API (GET /api/users/selectAll).
 * Demonstrates the loading / error / empty / data states the rest of the
 * feature pages will follow. Requires the Go backend running on :8080.
 */
export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await usersApi.selectAll()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">用户管理</div>
            <h1 className={styles.title}>用户列表</h1>
          </div>
          <Button variant="tertiary" onClick={() => void load()} disabled={loading}>
            {loading ? '加载中…' : '刷新'}
          </Button>
        </div>

        {error ? (
          <div className={styles.notice} role="alert">
            <Tag kind="red">错误</Tag>
            <span>无法加载用户数据：{error}</span>
          </div>
        ) : loading ? (
          <p className={styles.muted}>正在加载用户数据…</p>
        ) : users.length === 0 ? (
          <p className={styles.muted}>暂无用户数据。</p>
        ) : (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
