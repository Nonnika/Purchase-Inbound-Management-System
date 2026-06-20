import type { InputHTMLAttributes, ReactNode } from 'react'
import styles from './TextInput.module.css'

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  /** Helper text below the field. Replaced by the error message when `error` is set. */
  helper?: ReactNode
  error?: string
}

/**
 * Carbon-inspired text input: Gray 10 field, bottom-border indicator only
 * (transparent default → Gray 100 active → Blue 60 focus → Red 60 error).
 * 0px radius, 40px height. See DESIGN.md §4 Inputs & Forms.
 */
export function TextInput({ label, helper, error, id, className, ...rest }: TextInputProps) {
  const fieldId = id ?? `field-${label}`
  const helperId = `${fieldId}-helper`
  return (
    <div className={[styles.group, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        className={[styles.input, error ? styles.error : ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={helper || error ? helperId : undefined}
        {...rest}
      />
      {(helper || error) && (
        <div id={helperId} className={[styles.helper, error ? styles.helperError : ''].join(' ')}>
          {error ?? helper}
        </div>
      )}
    </div>
  )
}
