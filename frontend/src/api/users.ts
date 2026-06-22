import { apiClient } from './client'
import type { AffectedResult, User, UserInput } from '@/types/user'

/**
 * User API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/userController.go RegisterRouter):
 *   GET  /api/users/selectAll
 *   GET  /api/users/selectById?id=<int>
 *   GET  /api/users/selectByUserName?username=<string>
 *   GET  /api/users/deleteById?id=<int>      -> { affected }
 *   POST /api/users/insert                    -> { affected }  (body: UserInput)
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

  /** Returns the matching user, or null when not found. */
  async selectByUserName(username: string): Promise<User | null> {
    const res = await apiClient.get<User>('/users/selectByUserName', {
      params: { username },
    })
    // DAO ignores not-found errors and returns a zero-value struct; treat an
    // empty username on the response as "not found".
    return res.data && res.data.id ? res.data : null
  },

  deleteById(id: number): Promise<AffectedResult> {
    return apiClient
      .get<AffectedResult>('/users/deleteById', { params: { id } })
      .then((res) => res.data)
  },

  insert(payload: UserInput): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/users/insert', payload)
      .then((res) => res.data)
  },
}
