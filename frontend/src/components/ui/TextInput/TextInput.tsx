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
            {visible ? '🙈' : '👁'}
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
