import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Modal.module.css'

export interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Footer area, typically action buttons. */
  footer?: ReactNode
  /** Whether clicking the scrim (outside the card) closes the modal. Default true. */
  closeOnScrimClick?: boolean
  /** Whether pressing Escape closes the modal. Default true. */
  closeOnEscape?: boolean
}

/**
 * Carbon-style overlay modal: dark scrim + raised panel (the one place shadows
 * are used, per DESIGN.md §6 Overlay level). Closes on scrim click and Escape
 * by default — both can be disabled for flows with unsaved input (e.g. create
 * forms), where closing must be an explicit action.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  closeOnScrimClick = true,
  closeOnEscape = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, closeOnEscape])

  if (!open) return null

  return createPortal(
    <div
      className={styles.scrim}
      onClick={closeOnScrimClick ? onClose : undefined}
      role="presentation"
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.close} onClick={onClose} aria-label="关闭" type="button">
            ✕
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
