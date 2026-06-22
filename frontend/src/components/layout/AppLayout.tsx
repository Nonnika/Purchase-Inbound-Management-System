import { NavLink, Outlet } from 'react-router-dom'
import styles from './AppLayout.module.css'

const navItems = [
  { to: '/', label: '概览', end: true },
  { to: '/users', label: '用户管理' },
  { to: '/purchasing', label: '采购管理' },
  { to: '/inbound', label: '入库管理' },
]

/**
 * Application shell: dark Carbon masthead (Gray 100, 48px) + content outlet + footer.
 * Active link uses white text with a 2px bottom-border indicator (DESIGN.md §4 Navigation).
 */
export function AppLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <div className={`${styles.navInner} container`}>
          <NavLink to="/" className={styles.brand}>
            PIMS · 采购入库管理系统
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
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className="container">
          Purchase Inbound Management System · 数据库课程项目 · 前端 Vite + React + TypeScript
        </div>
      </footer>
    </div>
  )
}
