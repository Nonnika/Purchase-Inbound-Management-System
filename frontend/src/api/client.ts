import axios from 'axios'
import { ApiError, fromAxiosError } from './errors'

/**
 * Shared axios instance. Base URL is `/api` so requests hit the Vite dev proxy
 * (-> backend on :8080) in dev, and are served same-origin in production.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// Every failed request is normalized into an `ApiError` carrying the HTTP
// status, a stable code, a short reason, and the backend `{ message }` detail.
// Callers can then branch on `err.status` / `err.code` and show code + reason.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(fromAxiosError(error))
  },
)

export { ApiError }
