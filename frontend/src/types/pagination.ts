/**
 * Pagination contract — mirrors the Go/Gin backend
 * (backend/internal/controller/pagination.go).
 *
 * The backend migrated every `selectAll` list endpoint from `GET -> T[]` to
 * `POST -> { list, total }`, reading `{ page, page_size }` from the JSON body
 * (form-encoded also accepted). Server-side defaults: `page <= 0` -> 1,
 * `page_size <= 0` -> 10, `page_size > 100` -> 100. Rows are `order by id desc`.
 *
 * Keep this in sync with `pagination.go` if the backend shape changes.
 */

/** Request body for a paginated `selectAll` call. Both fields optional. */
export interface PageParams {
  page?: number
  page_size?: number
}

/** Response envelope returned by every paginated `selectAll` endpoint. */
export interface Paginated<T> {
  list: T[]
  total: number
}
