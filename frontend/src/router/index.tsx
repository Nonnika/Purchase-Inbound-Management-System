import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/home/HomePage'
import { UsersPage } from '@/pages/users/UsersPage'
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
      // Placeholder routes — pages to be built out as the backend grows.
      { path: 'purchasing', element: <HomePage /> },
      { path: 'inbound', element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
