import { apiClient } from './client'
import type { AffectedResult, User, UserInput } from '@/types/user'

/**
 * User API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/userController.go RegisterRouter):
 *   GET  /api/users/selectAll
 *   GET  /api/users/selectById?id=<int>
 *   GET  /api/users/selectByUserName?user_name=<string>   (note: user_name, not username)
 *   GET  /api/users/deleteById?id=<int>                    -> { affected }
 *   POST /api/users/insert                                 -> { affected }  (body: UserInput JSON)
 *   POST /api/users/UpdatePasswordById?id=<int>            -> { affected }  (form field: password)
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure,
 * carrying the HTTP status, a stable code, a short reason, and the backend detail.
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

  /**
   * Look up a single user by username. The backend reads the `user_name` query
   * param. Returns null when no matching user is found.
   *
   * NOTE: the current DAO ignores the not-found error and returns a zero-value
   * user (id=0) with HTTP 200, so we detect "not found" via an empty id. If the
   * DAO is later fixed to return 404, that surfaces as an ApiError(NOT_FOUND)
   * which callers handle separately.
   */
  async selectByUserName(userName: string): Promise<User | null> {
    const res = await apiClient.get<User>('/users/selectByUserName', {
      params: { user_name: userName },
    })
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

  /**
   * Update a user's password. The backend reads `id` from the query string and
   * `password` from multipart form data (ctx.PostForm), then bcrypt-hashes it
   * server-side — unlike insert, which stores password_hash verbatim.
   */
  updatePasswordById(id: number, password: string): Promise<AffectedResult> {
    const form = new URLSearchParams()
    form.append('password', password)
    return apiClient
      .post<AffectedResult>('/users/UpdatePasswordById', form, {
        params: { id },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .then((res) => res.data)
  },
}
