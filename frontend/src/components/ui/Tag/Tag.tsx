import type { ReactNode } from 'react'
import styles from './Tag.module.css'

export type TagKind = 'blue' | 'red' | 'green' | 'gray'

export interface TagProps {
  kind?: TagKind
  children: ReactNode
}

const kindClass: Record<TagKind, string> = {
  blue: styles.blue,
  red: styles.red,
  green: styles.green,
  gray: styles.gray,
}

/**
 * Carbon-inspired tag/label — the sole rounded exception (24px pill).
 * Contextual color at ~10% tint background + 60-grade text. DESIGN.md §4 Tag.
 */
export function Tag({ kind = 'blue', children }: TagProps) {
  return <span className={[styles.tag, kindClass[kind]].join(' ')}>{children}</span>
}
