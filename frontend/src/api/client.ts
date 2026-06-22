import axios from 'axios'

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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Backend returns `{ message: string }` on 500. Normalize into a message string.
    const message =
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message ??
      '请求失败'
    return Promise.reject(new Error(message))
  },
)
