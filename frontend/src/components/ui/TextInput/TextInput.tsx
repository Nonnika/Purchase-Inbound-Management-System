import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './TextInput.module.css'

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  /** Helper text below the field. Replaced by the error message when `error` is set. */
  helper?: ReactNode
  error?: string
  /** When true (and type="password"), renders an eye toggle to reveal the value. */
  reveal?: boolean
}

/**
 * Carbon-inspired text input: Gray 10 field, bottom-border indicator only
 * (transparent default → Gray 100 active → Blue 60 focus → Red 60 error).
 * 0px radius, 40px height. See DESIGN.md §4 Inputs & Forms.
 */
export function TextInput({ label, helper, error, reveal, id, className, type, ...rest }: TextInputProps) {
  const fieldId = id ?? `field-${label}`
  const helperId = `${fieldId}-helper`

  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword && visible ? 'text' : type

  return (
    <div className={[styles.group, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <div className={styles.fieldWrap}>
        <input
          id={fieldId}
          className={[styles.input, error ? styles.error : '', reveal && isPassword ? styles.hasToggle : '']
            .filter(Boolean)
            .join(' ')}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={helper || error ? helperId : undefined}
          {...rest}
        />
        {reveal && isPassword && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? '隐藏密码' : '显示密码'}
            aria-pressed={visible}
          >
            {visible ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.4 5.2A9.5 9.5 0 0 1 12 5c5 0 9 4.5 10 7a13.6 13.6 0 0 1-2.2 3.1M6.6 6.6C4.3 8 2.7 10.2 2 12c1 2.5 5 7 10 7a9.8 9.8 0 0 0 4.2-1" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {(helper || error) && (
        <div id={helperId} className={[styles.helper, error ? styles.helperError : ''].join(' ')}>
          {error ?? helper}
        </div>
      )}
    </div>
  )
}
