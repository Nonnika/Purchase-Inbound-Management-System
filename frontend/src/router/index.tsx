import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/home/HomePage'
import { UsersPage } from '@/pages/users/UsersPage'
import { RolesPage } from '@/pages/roles/RolesPage'
import { DepartmentsPage } from '@/pages/departments/DepartmentsPage'
import { OrdersPage } from '@/pages/orders/OrdersPage'
import { ItemsPage } from '@/pages/items/ItemsPage'
import { WarehousesPage } from '@/pages/warehouses/WarehousesPage'
import { CategoriesPage } from '@/pages/categories/CategoriesPage'
import { LoginPage } from '@/pages/login/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { isLoggedIn } from '@/api/auth'
import type { ReactNode } from 'react'

/** Route guard: redirects to /login (with a `from` param) when no session. */
function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!isLoggedIn()) {
    const from = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?from=${from}`} replace />
  }
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'departments', element: <DepartmentsPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'items', element: <ItemsPage /> },
      { path: 'warehouses', element: <WarehousesPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      // The procurement flow lives on the unified /orders page; these legacy
      // nav entries alias there so existing links keep working.
      { path: 'purchasing', element: <OrdersPage /> },
      { path: 'inbound', element: <OrdersPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
