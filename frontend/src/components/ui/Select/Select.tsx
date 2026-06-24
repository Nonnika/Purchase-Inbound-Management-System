import type { ReactNode, SelectHTMLAttributes } from 'react'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: string
  /** The `<option>` list. Include the leading placeholder/「全部」option here. */
  options: SelectOption[]
  /** Helper text below the field. Replaced by the error message when `error` is set. */
  helper?: ReactNode
  error?: string
}

/**
 * Carbon-inspired bottom-border `<select>`, styled to match `TextInput`: Gray 10
 * field, transparent default border, Blue 60 focus indicator, 0px radius, 40px
 * height. The label mirrors TextInput's `.label` (12px, weight 400, secondary
 * color) so the two read identically in the same form. See DESIGN.md §4 Inputs.
 */
export function Select({ label, options, helper, error, id, className, ...rest }: SelectProps) {
  const fieldId = id ?? `field-${label}`
  const helperId = `${fieldId}-helper`

  return (
    <div className={[styles.group, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <select
        id={fieldId}
        className={[styles.select, error ? styles.error : ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={helper || error ? helperId : undefined}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {(helper || error) && (
        <div id={helperId} className={[styles.helper, error ? styles.helperError : ''].join(' ')}>
          {error ?? helper}
        </div>
      )}
    </div>
  )
}
