# Purchase Inbound Management System

![Go](https://img.shields.io/badge/go-%2300ADD8.svg?style=for-the-badge&logo=go&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens) 
	![MySQL](https://img.shields.io/badge/mysql-4479A1.svg?style=for-the-badge&logo=mysql&logoColor=white)  
Purchase Inbound Management System, or PIMS, is a database course project for managing users, departments, roles, warehouses, item categories, inventory items, and purchase/outbound orders.

The repository contains a Go backend API and a React frontend.

## Project Structure

```text
.
|-- backend/              # Go API service
|   |-- cmd/server/       # Application entry point
|   |-- internal/         # Controllers, DAOs, models, auth, config
|   |-- migrations/       # MySQL schema migrations
|   `-- tests/            # API and behavior tests
|-- frontend/             # Vite + React + TypeScript frontend
`-- tests/                # Postman collection and external test assets
```

## Backend

The backend is a Go module named `github.com/nonnika/pims`. It uses Gin for HTTP routing, sqlx with MySQL for persistence, bcrypt for password hashing, and JWT for authentication.

### Environment

Create `backend/.env` before running the server:

```env
DB_USER=root
DB_PASSWD=your_password
DB_PORT=3306
DB_PARAMS=parseTime=true&loc=Local
DB_NAME=pims
JWT_SECRET=replace-with-at-least-32-bytes-secret
JWT_ISSUER=pims
```

`JWT_SECRET` must be at least 32 bytes.

### Database

Migrations are stored in `backend/migrations/` and use goose-style `-- +goose Up` / `-- +goose Down` markers.

Run the migrations against a MySQL database before starting the API. For example, with goose installed:

```bash
cd backend
goose -dir migrations mysql "$DB_USER:$DB_PASSWD@tcp(127.0.0.1:$DB_PORT)/$DB_NAME?$DB_PARAMS" up
```

### Commands

```bash
cd backend
go mod tidy
go run ./cmd/server
go test ./...
go build ./cmd/server
```

The API listens on `:8080` and routes are registered under `/api`.

## Frontend

The frontend is built with Vite, React, and TypeScript.

```bash
cd frontend
npm install
npm run dev
npm run build
npm run typecheck
```

## API Areas

- Users: login, registration, profile fields, status, role, and department assignment
- Roles: role lookup by id, name, and code
- Departments: organization hierarchy
- Warehouses: warehouse metadata
- Item categories: category hierarchy
- Items: inventory, frozen inventory, warehouse, category, price, and warning level
- Orders: purchase requests, outbound requests, audit steps, warehouse steps, deletion events, and event-chain verification

## Testing

Run backend tests before committing backend changes:

```bash
cd backend
go test ./...
```

The `backend/tests/` package covers API authentication, validation, user behavior, and password encoding. JWT tests live under `backend/internal/jwt/`.

## Contributing

Start from the latest `main` branch:

```bash
git switch main
git pull origin main
```

Create a feature branch:

```bash
git switch -c feature/<your-feature-name>
```

Push your branch:

```bash
git push -u origin feature/<your-feature-name>
```

When `main` changes, merge or rebase it into your feature branch before opening a pull request.

## Security Notes

- Do not commit real secrets or local database credentials.
- Keep credentials in `.env`.
- Use a strong `JWT_SECRET` with at least 32 bytes.
- Review route permissions carefully when changing authentication, role checks, or order workflows.
