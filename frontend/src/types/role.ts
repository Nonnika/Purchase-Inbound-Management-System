/**
 * Mirrors backend model `internal/database/model/role.go` and the
 * `roles` table migration. Keep these fields in sync if the backend schema changes.
 *
 * Roles are a fixed enum seeded by migration:
 *   1 admin, 2 purchaser, 3 warehouse, 4 auditor, 5 applicant
 * (see model.RoleAdmin..RoleApplicant constants). The API is read-only — the
 * backend exposes no create/update/delete for roles.
 */
export interface Role {
  id: number
  name: string
  code: string
  description: string
  created_at: string
}

/** Backend role id constants (model.Role*). Used for role-based UI logic. */
export const ROLE_ID = {
  ADMIN: 1,
  PURCHASER: 2,
  WAREHOUSE: 3,
  AUDITOR: 4,
  APPLICANT: 5,
} as const
