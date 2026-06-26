import type { ReactNode } from 'react'
import styles from './TreeIndent.module.css'

export interface TreeIndentProps {
  /** Depth of this node (0 = root). Drives the indentation + guide-line count. */
  depth: number
  /**
   * Per-ancestor guide flags, length === `depth`. `guides[k]` is true when the
   * ancestor at depth `k` has a following sibling, so a vertical guide line
   * should run through this row at column `k` to connect that ancestor's later
   * descendants/siblings. The last entry (`guides[depth-1]`, the parent) also
   * feeds the elbow's vertical continuation.
   */
  guides: boolean[]
  /** Whether this node is the last child of its parent (draws └ vs ├). */
  isLast: boolean
  /** Whether this node has children (renders a +/− badge vs a spacer). */
  hasChildren: boolean
  /** Whether this node is currently expanded (badge − vs +). */
  expanded: boolean
  onToggle: () => void
  /** The node label (typically a Tag). */
  children: ReactNode
}

/**
 * TreeIndent — the indentation + guide-line + expand-badge prefix for one row
 * of a tree table. Render it inside a `position: relative` table cell (the page
 * adds that). It draws:
 *
 *   - one vertical hairline per ancestor column whose subtree continues past
 *     this row (`guides[k]`), spanning the full cell height so lines connect
 *     across rows;
 *   - an elbow connector at the parent column (├ when the node has a following
 *     sibling or an ancestor's line continues, └ when it terminates here);
 *   - a +/− badge for parent nodes (clickable, mirrors the whole-row toggle the
 *     page wires up), a fixed-width spacer for leaves so labels stay aligned.
 *
 * Carbon-consistent: hairline `--cds-border-tile` lines, 0px radius, no new
 * colors. The 8px-grid slot width is `--space-05` (20px), matching the previous
 * blank indent spans so existing column widths are preserved.
 */
export function TreeIndent({
  depth,
  guides,
  isLast,
  hasChildren,
  expanded,
  onToggle,
  children,
}: TreeIndentProps) {
  // The elbow's vertical at the parent column (depth-1) runs full height when
  // either this node has a following sibling (!isLast) or an ancestor line
  // continues through it (guides[depth-1]); otherwise it stops at the elbow
  // (top half only → └).
  const elbowFull = depth >= 1 && (guides[depth - 1] || !isLast)

  return (
    <>
      <span className={styles.guideLayer} aria-hidden="true">
        {/* Ancestor guide lines for columns 0..depth-2 (column depth-1 is the elbow). */}
        {guides.slice(0, Math.max(0, depth - 1)).map((on, k) =>
          on ? (
            <span
              key={k}
              className={styles.guideLine}
              style={{ left: `calc(var(--space-05) * ${k} + var(--space-05) / 2)` }}
            />
          ) : null,
        )}
        {depth >= 1 && (
          <span
            className={[styles.elbow, elbowFull ? '' : styles.elbowLast].filter(Boolean).join(' ')}
            style={{ left: `calc(var(--space-05) * ${depth - 1} + var(--space-05) / 2)` }}
          />
        )}
      </span>
      <div className={styles.content} style={{ marginLeft: `calc(var(--space-05) * ${depth})` }}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.badge}
            onClick={(e) => {
              // Stop so a click on the badge (inside the already-whole-row-
              // clickable <tr>) doesn't double-fire the row toggle.
              e.stopPropagation()
              onToggle()
            }}
            aria-label={expanded ? '折叠' : '展开'}
            aria-expanded={expanded}
          >
            {expanded ? '−' : '+'}
          </button>
        ) : (
          <span className={styles.badgeSpacer} aria-hidden="true" />
        )}
        {children}
      </div>
    </>
  )
}
