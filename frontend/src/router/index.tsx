import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/home/HomePage'
import { UsersPage } from '@/pages/users/UsersPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
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
