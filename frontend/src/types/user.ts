/**
 * Mirrors backend model `internal/database/model/user.go` and the
 * `users` table migration. Keep these fields in sync if the backend schema changes.
 */
export interface User {
  id: number
  username: string
  password_hash: string
  real_name: string
  phone: string
  role_id: number
  department_id: number
  /** 1 = 正常, 0 = 禁用 */
  status: number
  created_at: string
  updated_at: string
}

export const USER_STATUS = {
  ACTIVE: 1,
  DISABLED: 0,
} as const
