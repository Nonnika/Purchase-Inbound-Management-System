/**
 * Status-code-aware error handling for the API layer.
 *
 * The Go/Gin backend (backend/internal/controller/userController.go) returns a
 * uniform `{ message: string }` body on failure with these status codes:
 *   200 — success
 *   400 — bad request: missing/invalid input
 *         (SelectById id required; SelectByUserName user_name required;
 *          Insert bind fail / username empty; UpdatePasswordById id/user/password empty)
 *   404 — not found (SelectById / SelectByUserName on sql.ErrNoRows — note the DAO
 *         currently swallows that error, so 404 may not fire in practice)
 *   500 — server error: DB/parse failures
 *
 * This module turns any failure (HTTP error, network drop, timeout) into an
 * `ApiError` carrying a stable `code`, the `status`, a short Chinese `reason`,
 * and the raw backend `detail` — so the UI can show the code + reason instead
 * of a raw English stack-ish message.
 */

/** Stable short codes the UI can switch on. */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'UNKNOWN'

export interface ApiErrorInit {
  code: ApiErrorCode
  status: number | null
  reason: string
  detail: string
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | null
  readonly reason: string

  constructor({ code, status, reason, detail }: ApiErrorInit) {
    super(detail)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.reason = reason
  }
}

/** Map an HTTP status (or null for transport errors) to a code + short reason. */
function classify(status: number | null, detail: string): { code: ApiErrorCode; reason: string } {
  if (status === null) {
    // No response reached us.
    return /timeout/i.test(detail)
      ? { code: 'TIMEOUT', reason: '请求超时，请稍后重试' }
      : { code: 'NETWORK', reason: '网络连接失败，请检查后端服务是否运行' }
  }
  switch (status) {
    case 400:
      return { code: 'BAD_REQUEST', reason: '请求参数有误' }
    case 401:
      return { code: 'UNAUTHORIZED', reason: '未授权，请先登录' }
    case 403:
      return { code: 'FORBIDDEN', reason: '无权限执行此操作' }
    case 404:
      return { code: 'NOT_FOUND', reason: '资源不存在' }
    case 500:
    case 502:
    case 503:
    case 504:
      return { code: 'SERVER_ERROR', reason: '服务器内部错误' }
    default:
      return status >= 500
        ? { code: 'SERVER_ERROR', reason: '服务器内部错误' }
        : status >= 400
          ? { code: 'CLIENT_ERROR', reason: '客户端请求错误' }
          : { code: 'UNKNOWN', reason: '未知错误' }
  }
}

/**
 * Build an ApiError from an axios error. Pulls the backend `{ message }` body
 * when present; otherwise falls back to the axios error message.
 */
export function fromAxiosError(error: unknown): ApiError {
  // axios error shape: { response?: { status, data }, request?, message, code? }
  const ax = error as {
    response?: { status?: number; data?: { message?: string } | string }
    request?: unknown
    message?: string
    code?: string
  }

  const status = ax.response?.status ?? null
  const dataMessage =
    typeof ax.response?.data === 'string'
      ? ax.response.data
      : ax.response?.data?.message
  const detail = dataMessage ?? ax.message ?? '请求失败'

  // axios sets code 'ECONNABORTED' for timeouts.
  if (status === null && (ax.code === 'ECONNABORTED' || /timeout/i.test(ax.message ?? ''))) {
    return new ApiError({ code: 'TIMEOUT', status: null, reason: '请求超时，请稍后重试', detail })
  }

  const { code, reason } = classify(status, detail)
  return new ApiError({ code, status, reason, detail })
}

/** Human-readable label for the code, e.g. "HTTP 400" or "NETWORK". */
export function errorLabel(err: ApiError): string {
  return err.status !== null ? `HTTP ${err.status}` : err.code
}

/** Normalize any thrown value into an ApiError (for catch blocks). */
export function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : fromAxiosError(err)
}
