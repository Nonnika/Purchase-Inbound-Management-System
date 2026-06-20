import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Trailing icon/glyph slot — Carbon buttons reserve asymmetric right padding for this. */
  iconRight?: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  tertiary: styles.tertiary,
  ghost: styles.ghost,
  danger: styles.danger,
}

/**
 * Carbon-inspired button.
 * 0px border-radius, 48px height, asymmetric padding (room for a trailing icon),
 * three weights only. See DESIGN.md §4 Buttons.
 */
export function Button({
  variant = 'primary',
  iconRight,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[styles.base, variantClass[variant], className].filter(Boolean).join(' ')}
      {...rest}
    >
      <span className={styles.label}>{children}</span>
      {iconRight ? <span className={styles.icon}>{iconRight}</span> : null}
    </button>
  )
}
