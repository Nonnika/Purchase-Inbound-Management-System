package model

import "time"

type User struct {
	Id           int64     `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	PasswordHash string    `json:"-" db:"password_hash"`
	RealName     string    `json:"real_name" db:"real_name"`
	Phone        string    `json:"phone" db:"phone"`
	RoleId       int64     `json:"role_id" db:"role_id"`
	DepartmentId int64     `json:"department_id" db:"department_id"`
	Status       int64     `json:"status" db:"status"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}
