import { apiClient } from './client'
import type { AffectedResult, User, UserInput } from '@/types/user'

/**
 * User API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/userController.go RegisterAuthRouter).
 * All routes below require a valid admin JWT (attached by the client interceptor):
 *   GET    /api/users/selectAll
 *   GET    /api/users/selectById?id=<int>
 *   GET    /api/users/selectByUserName?user_name=<string>   (note: user_name, not username)
 *   DELETE /api/users/deleteById?id=<int>                    -> { affected }
 *   POST   /api/users/register                               -> { affected }  (JSON: UserInput)
 *   POST   /api/users/UpdatePasswordById?id=<int>            -> { affected }  (form field: password)
 *   POST   /api/users/UpdateUserNameById?id=<int>            -> { affected }  (form field: user_name)
 *   POST   /api/users/UpdateRoleById?id=<int>                -> { affected }  (form field: role_id)
 *   POST   /api/users/UpdateRealNameById?id=<int>            -> { affected }  (JSON/ form: real_name)
 *   POST   /api/users/UpdatePhoneById?id=<int>               -> { affected }  (JSON/ form: phone)
 *
 * Login is handled separately in src/api/auth.ts (POST /users/verify, public).
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
   * param and returns 404 (ApiError NOT_FOUND) when no user matches.
   */
  selectByUserName(userName: string): Promise<User> {
    return apiClient
      .get<User>('/users/selectByUserName', { params: { user_name: userName } })
      .then((res) => res.data)
  },

  /** DELETE /users/deleteById?id=  (method is DELETE). */
  deleteById(id: number): Promise<AffectedResult> {
    return apiClient
      .delete<AffectedResult>('/users/deleteById', { params: { id } })
      .then((res) => res.data)
  },

  /**
   * Register a new user. The backend `Register` handler reads JSON
   * {username, password, real_name, phone, role_id, department_id} and
   * **hashes `password` server-side** (bcrypt) before storing — so `UserInput`
   * carries the plaintext `password`, not a hash.
   */
  register(payload: UserInput): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/users/register', payload)
      .then((res) => res.data)
  },

  /**
   * Update a user's password. The backend reads `id` from the query string and
   * `password` from form data, then bcrypt-hashes it server-side.
   */
  updatePasswordById(id: number, password: string): Promise<AffectedResult> {
    return postUserFormFields('/users/UpdatePasswordById', id, { password })
  },

  /** POST /users/UpdateUserNameById?id=  (form field: user_name) -> { affected }. */
  updateUserNameById(id: number, userName: string): Promise<AffectedResult> {
    return postUserFormFields('/users/UpdateUserNameById', id, { user_name: userName })
  },

  /** POST /users/UpdateRoleById?id=  (form field: role_id) -> { affected }. */
  updateRoleById(id: number, roleId: number): Promise<AffectedResult> {
    return postUserFormFields('/users/UpdateRoleById', id, { role_id: String(roleId) })
  },

  /**
   * POST /users/UpdateRealNameById?id=  (JSON: { real_name }) -> { affected }.
   * The backend binds `real_name` (*string) via ShouldBind and normalizes an
   * empty string to nil, so passing '' clears the field.
   */
  updateRealNameById(id: number, realName: string): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/users/UpdateRealNameById', { real_name: realName }, { params: { id } })
      .then((res) => res.data)
  },

  /**
   * POST /users/UpdatePhoneById?id=  (JSON: { phone }) -> { affected }.
   * Same nil-normalization as real_name: '' clears the phone.
   */
  updatePhoneById(id: number, phone: string): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/users/UpdatePhoneById', { phone }, { params: { id } })
      .then((res) => res.data)
  },
}

/**
 * POST form-encoded fields to a user Update* endpoint with `id` in the query
 * string. The backend reads these via ctx.PostForm, so they must be
 * application/x-www-form-urlencoded (not JSON).
 */
function postUserFormFields(
  path: string,
  id: number,
  fields: Record<string, string>,
): Promise<AffectedResult> {
  const form = new URLSearchParams()
  Object.entries(fields).forEach(([k, v]) => form.append(k, v))
  return apiClient
    .post<AffectedResult>(path, form, {
      params: { id },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    .then((res) => res.data)
}
