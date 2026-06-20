import { apiClient } from './client'
import type { User } from '@/types/user'

/**
 * User API — wraps the two endpoints currently exposed by the Go/Gin backend
 * (see backend/internal/controller/userController.go):
 *   GET /api/users/selectAll
 *   GET /api/users/selectById?id=<int>
 */
export const usersApi = {
  selectAll(): Promise<User[]> {
    return apiClient.get<User[]>('/users/selectAll').then((res) => res.data)
  },

  selectById(id: number): Promise<User> {
    return apiClient
      .get<User>('/users/selectById', { params: { id } })
      .then((res) => res.data)
  },
}
