/**
 * Mirrors backend model `internal/database/model/user.go` and the
 * `users` table migration. Keep these fields in sync if the backend schema changes.
 *
 * Notes on the current backend model:
 *   - `password_hash` is tagged `json:"-"`, so it is NEVER serialized in responses.
 *   - `real_name` / `phone` are `*string` (nullable) — null when unset.
 */
export interface User {
  id: number
  username: string
  real_name: string | null
  phone: string | null
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
 * Payload for `POST /api/users/register`. The backend `Register` handler binds
 * these fields (username, password, real_name, phone, role_id, department_id)
 * and **hashes `password` server-side** via bcrypt (encode.EncodePasswd) before
 * storing — so the client sends the plaintext password, not a hash.
 * `status` defaults to 1 (normal) in the DB; id / timestamps are auto-generated.
 */
export interface UserInput {
  username: string
  password: string
  real_name: string
  phone: string
  role_id: number
  department_id: number | null
}

/** Shape returned by the write endpoints (register / delete / update*): `{ affected: n }`. */
export interface AffectedResult {
  affected: number
}

/** Shape returned by `POST /api/users/verify` on success. */
export interface LoginResult {
  user: User
  /** Always true on a 200 response. */
  isTrue: boolean
  token: string
}
