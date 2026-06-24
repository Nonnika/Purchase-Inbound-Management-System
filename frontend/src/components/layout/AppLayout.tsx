import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '@/api/auth'
import { ROLE_ID } from '@/types/role'
import styles from './AppLayout.module.css'

/**
 * Nav entries. `roles` restricts visibility by the current user's role; when
 * omitted the entry is visible to every authenticated role.
 *
 * Visibility follows each section's backend READ permission (the gate that
 * decides whether the page can even load without 403), derived from the
 * controllers' RegisterAuthRouter:
 *   - users: GET /users/* are `middleware.Role(RoleAdmin)` — admin-only read,
 *     so the entry is hidden from non-admins. (Write buttons inside the page
 *     are separately role-gated there.)
 *   - orders: all roles read (admin/auditor/warehouse via selectAll,
 *     purchaser/applicant via selectByUserId for their own — see OrdersPage).
 *   - items / warehouses / categories / departments: reads open to any
 *     authenticated token; writes (and their buttons) are gated in-page.
 * Roles is a read-only resource not surfaced in the nav.
 */
interface NavItem {
  to: string
  label: string
  end?: boolean
  /** Allowed role ids; undefined = all authenticated roles. */
  roles?: number[]
}

const navItems: NavItem[] = [
  { to: '/', label: '概览', end: true },
  { to: '/orders', label: '订单管理' },
  { to: '/items', label: '物品管理' },
  { to: '/warehouses', label: '仓库管理' },
  { to: '/categories', label: '分类管理' },
  { to: '/users', label: '用户管理', roles: [ROLE_ID.ADMIN] },
  { to: '/departments', label: '部门管理' },
]

/**
 * Application shell: dark Carbon masthead (Gray 100, 48px) + content outlet + footer.
 * Active link uses white text with a 2px bottom-border indicator (DESIGN.md §4 Navigation).
 * The right side shows the logged-in user and a logout action.
 */
export function AppLayout() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const roleId = user?.role_id ?? 0

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // Hide nav entries the current role can't read (see navItems doc comment).
  const visibleNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(roleId),
  )

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <NavLink to="/" className={styles.brand}>
            PIMS采购入库管理系统
          </NavLink>
          <nav className={styles.links}>
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className={styles.session}>
            {user && <span className={styles.user}>{user.username}</span>}
            <button type="button" className={styles.logout} onClick={handleLogout}>
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className="container">
          Purchase Inbound Management System
        </div>
      </footer>
    </div>
  )
}
