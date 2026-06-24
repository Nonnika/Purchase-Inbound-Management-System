import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '@/api/auth'
import styles from './AppLayout.module.css'

const navItems = [
  { to: '/', label: '概览', end: true },
  { to: '/orders', label: '订单管理' },
  { to: '/items', label: '物品管理' },
  { to: '/warehouses', label: '仓库管理' },
  { to: '/categories', label: '分类管理' },
  { to: '/users', label: '用户管理' },
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

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <NavLink to="/" className={styles.brand}>
            PIMS采购入库管理系统
          </NavLink>
          <nav className={styles.links}>
            {navItems.map((item) => (
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
