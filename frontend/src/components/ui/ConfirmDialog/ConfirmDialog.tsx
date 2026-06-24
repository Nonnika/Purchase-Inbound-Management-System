import type { ReactNode } from 'react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import styles from './ConfirmDialog.module.css'

export type ConfirmTone = 'danger' | 'primary'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Body content — the consequence being confirmed. May be multi-line. */
  description: ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  /** Visual tone of the confirm button + leading icon. Default 'danger'. */
  tone?: ConfirmTone
  /** Disables the confirm button and shows a busy label (e.g. during the request). */
  busy?: boolean
}

/**
 * Carbon-style confirmation modal for destructive / irreversible actions
 * (delete, block, etc.). Wraps `Modal` with a leading status icon tile and a
 * tone-matched confirm button (Red 60 for `danger`). Replaces the native
 * `window.confirm` so the prompt matches the design system.
 *
 * Like the create/edit modals, it is explicit-close: scrim click and Escape
 * cancel (no unsaved input to lose), but the action only fires on the buttons.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'danger',
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      closeOnScrimClick
      closeOnEscape
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '处理中…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className={styles.row}>
        <span
          className={[styles.icon, tone === 'danger' ? styles.iconDanger : styles.iconPrimary]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          {tone === 'danger' ? '!' : 'i'}
        </span>
        <div className={styles.body}>{description}</div>
      </div>
    </Modal>
  )
}
