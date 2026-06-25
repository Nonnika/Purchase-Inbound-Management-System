import { apiClient } from './client'
import type { PageParams, Paginated } from '@/types/pagination'
import type { AffectedResult, User, UserInput } from '@/types/user'

/**
 * User API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/userController.go RegisterAuthRouter).
 * All routes below require a valid admin JWT (attached by the client interceptor):
 *   POST   /api/users/selectAll        (body {page, page_size} -> {list, total})
 *   GET    /api/users/selectById?id=<int>
 *   GET    /api/users/selectByUserName?user_name=<string>   (note: user_name, not username)
 *   DELETE /api/users/deleteById?id=<int>                    -> { affected }
 *   POST   /api/users/register                               -> { affected }  (JSON: UserInput)
 *   POST   /api/users/UpdatePasswordById?id=<int>            -> { affected }  (form field: password)
 *   POST   /api/users/UpdateUserNameById?id=<int>            -> { affected }  (form field: user_name)
 *   POST   /api/users/UpdateRoleById?id=<int>                -> { affected }  (form field: role_id)
 *   POST   /api/users/UpdateRealNameById?id=<int>            -> { affected }  (JSON/ form: real_name)
 *   POST   /api/users/UpdatePhoneById?id=<int>               -> { affected }  (JSON/ form: phone)
 *   POST   /api/users/blockById?id=<int>                     -> { affected }  (no body; status -> 0)
 *   POST   /api/users/unblockById?id=<int>                   -> { affected }  (no body; status -> 1)
 *   POST   /api/users/updateMyPassword                       -> { affected }  (JSON: old_password, new_password)
 *
 * `updateMyPassword` is the only self-service write here: any authenticated
 * user may call it (no admin gate) to change their *own* password. Non-admins
 * must supply a correct `old_password`; admins may skip it. Login is handled
 * separately in src/api/auth.ts (POST /users/verify, public).
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure,
 * carrying the HTTP status, a stable code, a short reason, and the backend detail.
 */
export const usersApi = {
  /**
   * Paginated user list. POST with `{ page, page_size }`; the backend returns
   * `{ list, total }` (rows ordered by id desc). Defaults to page 1 / size 10.
   */
  selectAll(params: PageParams = {}): Promise<Paginated<User>> {
    return apiClient
      .post<Paginated<User>>('/users/selectAll', params)
      .then((res) => res.data)
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
   * POST /users/UpdateDepartmentById?id=  (form field: department_id) -> { affected }.
   * The backend reads `department_id` via ctx.PostForm, so it must be
   * form-encoded (like the other three ctx.PostForm user updates).
   */
  updateDepartmentById(id: number, departmentId: number): Promise<AffectedResult> {
    return postUserFormFields('/users/UpdateDepartmentById', id, {
      department_id: String(departmentId),
    })
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

  /**
   * POST /users/blockById?id=  (no body) -> { affected }. Sets status to 0
   * (blocked). The backend reads only the `id` query param. A blocked user is
   * refused at /users/verify with 403 `user is disabled`.
   */
  blockById(id: number): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/users/blockById', undefined, { params: { id } })
      .then((res) => res.data)
  },

  /** POST /users/unblockById?id=  (no body) -> { affected }. Sets status to 1 (normal). */
  unblockById(id: number): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/users/unblockById', undefined, { params: { id } })
      .then((res) => res.data)
  },

  /**
   * POST /users/updateMyPassword  (any authenticated user; no role gate) ->
   * { affected }. Changes the *current* user's password. The backend binds JSON
   * `{ old_password, new_password }`; non-admins must supply a correct
   * `old_password` (a wrong one yields 401 `old_password is wrong`), while
   * admins may skip it. The new password is bcrypt-hashed server-side.
   *
   * Note: a 401 here is a business error (wrong old password), NOT token expiry
   * — client.ts excludes this endpoint from the 401 auto-logout so the form can
   * surface it inline.
   */
  updateMyPassword(oldPassword: string, newPassword: string): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/users/updateMyPassword', {
        old_password: oldPassword,
        new_password: newPassword,
      })
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
