package model

import "time"

// Warehouse 仓库
type Warehouse struct {
	Id          int64     `json:"id" form:"id" db:"id"`
	Name        string    `json:"name" form:"name" db:"name"`
	Description *string   `json:"description" form:"description" db:"description"`
	CreateAt    time.Time `json:"create_at" form:"create_at" db:"create_at"`
}
