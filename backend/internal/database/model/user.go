package model

import "time"

type User struct {
	Id           int64
	Username     string
	PasswordHash string
	RealName     string
	Phone        string
	RoleId       int64
	DepartmentId int64
	Status       int64
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
