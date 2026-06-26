import { Link } from 'react-router-dom'
import { Tag, type TagKind } from '@/components/ui/Tag/Tag'
import { ROLE_ID } from '@/types/role'
import shared from './shared.module.css'
import styles from './ShortcutGrid.module.css'

/**
 * 控制台快捷入口。`roles` 限制可见性（undefined = 全角色），
 * 镜像 AppLayout 的 nav 门控，避免链接到无权页面（如 /users 仅 admin）。
 */
interface Shortcut {
  to: string
  label: string
  desc: string
  tag: string
  tagKind: TagKind
  roles?: number[]
}

const SHORTCUTS: Shortcut[] = [
  { to: '/orders', label: '订单管理', desc: '采购申请、出库申请与订单流转', tag: '业务', tagKind: 'blue' },
  { to: '/items', label: '物品管理', desc: '物品档案、库存与预警阈值', tag: '库存', tagKind: 'green' },
  { to: '/warehouses', label: '仓库管理', desc: '仓库档案与存储统计', tag: '库存', tagKind: 'green' },
  { to: '/categories', label: '分类管理', desc: '物品分类树维护', tag: '基础', tagKind: 'gray' },
  { to: '/departments', label: '部门管理', desc: '组织架构树维护', tag: '基础', tagKind: 'gray' },
  { to: '/users', label: '用户管理', desc: '用户、角色与封禁', tag: '权限', tagKind: 'gray', roles: [ROLE_ID.ADMIN] },
]

interface ShortcutGridProps {
  roleId: number
}

export function ShortcutGrid({ roleId }: ShortcutGridProps) {
  const visible = SHORTCUTS.filter((s) => !s.roles || s.roles.includes(roleId))
  return (
    <section className={shared.panel}>
      <div className={shared.panelHead}>
        <h2 className={shared.panelTitle}>快捷入口</h2>
      </div>
      <div className={styles.shortcuts}>
        {visible.map((s) => (
          <Link key={s.to} to={s.to} className={styles.shortcut}>
            <Tag kind={s.tagKind}>{s.tag}</Tag>
            <h3 className={styles.shortcutTitle}>{s.label}</h3>
            <p className={styles.shortcutDesc}>{s.desc}</p>
            <span className={styles.shortcutArrow} aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
