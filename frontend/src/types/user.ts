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

/**
 * Payload for `POST /api/users/insert`.
 * The backend INSERT writes exactly these columns (see dao.Insert): username,
 * password_hash, real_name, phone, role_id, department_id. `status` defaults to
 * 1 (normal) in the DB; id / timestamps are auto-generated. password_hash is
 * stored as-is — the backend does not hash on insert.
 */
export interface UserInput {
  username: string
  password_hash: string
  real_name: string
  phone: string
  role_id: number
  department_id: number | null
}

/** Shape returned by the write endpoints (insert / deleteById): `{ affected: n }`. */
export interface AffectedResult {
  affected: number
}
