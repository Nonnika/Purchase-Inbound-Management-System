import axios from 'axios'
import { ApiError, fromAxiosError } from './errors'
import { clearSession, getToken } from './auth'

/**
 * Shared axios instance. Base URL is `/api` so requests hit the Vite dev proxy
 * (-> backend on :8080) in dev, and are served same-origin in production.
 *
 * - Request interceptor attaches `Authorization: Bearer <token>` when a session
 *   exists (backend auth middleware requires it on all `/users/*` routes except
 *   `/users/verify`).
 * - Response interceptor normalizes failures into `ApiError` (HTTP status +
 *   code + reason). On 401 it clears the stale session and bounces to /login.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = fromAxiosError(error)
    // Expired / invalid token: drop the session and force re-login.
    // Skip the redirect for endpoints whose 401 is a legitimate business error
    // rather than token expiry: the login call (verify returns 401 for bad
    // credentials) and self-service password change (updateMyPassword returns
    // 401 when the supplied old_password is wrong — the form shows that inline
    // instead of logging the user out for a typo).
    const url = (error?.config?.url as string | undefined) ?? ''
    const isPasswordBusiness401 =
      apiError.status === 401 &&
      (url.includes('/users/verify') || url.includes('/users/updateMyPassword'))
    if (apiError.status === 401 && !isPasswordBusiness401) {
      clearSession()
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(apiError)
  },
)

export { ApiError }
