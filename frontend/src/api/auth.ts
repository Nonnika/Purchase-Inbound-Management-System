import { apiClient } from './client'
import type { LoginResult, User } from '@/types/user'
import { toApiError } from './errors'

/**
 * Auth: JWT token + current-user persistence.
 *
 * The backend `POST /api/users/verify` accepts form fields `username` + `password`
 * and returns `{ user, isTrue, token }`. All other `/users/*` routes require an
 * `Authorization: Bearer <token>` header (admin role). The token is an HS256 JWT
 * with a 48h expiry issued by the backend.
 *
 * Token + user are kept in localStorage so a page refresh stays logged in. The
 * request interceptor (client.ts) attaches the header; the response interceptor
 * clears these on 401.
 */

const TOKEN_KEY = 'pims.token'
const USER_KEY = 'pims.user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getCurrentUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

/**
 * Log in via `POST /users/verify`. The backend reads `username` and `password`
 * from form data (ctx.PostForm), not JSON. On success stores the token + user.
 * Throws `ApiError` (code/reason) on failure — 400 (bad credentials / unknown
 * user) or 401 (wrong password).
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  try {
    const res = await apiClient.post<LoginResult>('/users/verify', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    setSession(res.data.token, res.data.user)
    return res.data
  } catch (err) {
    throw toApiError(err)
  }
}

export function logout(): void {
  clearSession()
}
