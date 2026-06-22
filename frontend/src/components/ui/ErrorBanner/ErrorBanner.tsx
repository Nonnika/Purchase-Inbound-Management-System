import type { ReactNode } from 'react'
import type { ApiError } from '@/api/errors'
import { errorLabel } from '@/api/errors'
import styles from './ErrorBanner.module.css'

export interface ErrorBannerProps {
  error: ApiError
  /** Optional context prefix, e.g. "删除失败". */
  prefix?: string
  /** Extra content rendered on the right (e.g. a retry button). */
  action?: ReactNode
}

/**
 * Carbon-style inline error banner: red code tag + short reason, with the
 * backend message as secondary detail. Use anywhere a failed operation needs
 * to surface its status code and a concise cause to the user.
 */
export function ErrorBanner({ error, prefix, action }: ErrorBannerProps) {
  // ApiError stores the backend detail in `message` (via super(detail)).
  const detail = error.message
  return (
    <div className={styles.banner} role="alert">
      <div className={styles.main}>
        <span className={styles.code} aria-label={`错误码 ${errorLabel(error)}`}>
          {errorLabel(error)}
        </span>
        <span className={styles.reason}>
          {prefix ? `${prefix}：` : ''}
          {error.reason}
        </span>
      </div>
      {detail && detail !== error.reason && <div className={styles.detail}>{detail}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
