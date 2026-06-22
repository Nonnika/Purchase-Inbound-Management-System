package model

import "time"

// Role 角色模型
type Role struct {
	Id          int64     `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Code        string    `json:"code" db:"code"`
	Description string    `json:"description" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// 角色代码
const (
	RoleAdmin int64 = iota + 1
	RolePurchaser
	RoleWarehouse
	RoleAuditor
	RoleApplicant
)
