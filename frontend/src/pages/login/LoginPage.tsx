import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '@/api/auth'
import { toApiError, type ApiError } from '@/api/errors'
import { Button } from '@/components/ui/Button/Button'
import { TextInput } from '@/components/ui/TextInput/TextInput'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './LoginPage.module.css'

/**
 * Login page — calls `POST /api/users/verify` (form fields username + password).
 * On success stores the JWT + user and redirects to the page the user came from
 * (or `/`). Public route (no auth required).
 */
export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setSubmitting(true)
    setError(null)
    try {
      await login(username.trim(), password)
      const target = new URLSearchParams(window.location.search).get('from') ?? '/'
      navigate(target, { replace: true })
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.heading}>
          <div className={styles.eyebrow}>PIMS</div>
          <h1 className={styles.title}>登录</h1>
          <p className={styles.subtitle}>物品采购入库管理系统 · 请使用管理员账号登录</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <TextInput
            label="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="登录用户名"
            autoComplete="username"
            autoFocus
          />
          <TextInput
            label="密码"
            type="password"
            reveal
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="登录密码"
            autoComplete="current-password"
          />
          {error && <ErrorBanner error={error} prefix="登录失败" />}
          <Button type="submit" variant="primary" disabled={submitting || !username.trim() || !password}>
            {submitting ? '登录中…' : '登录'}
          </Button>
        </form>
      </div>
    </div>
  )
}
