package model

import "time"

type Department struct {
	Id          int64     `json:"id" form:"id" db:"id"`
	Name        string    `json:"name" form:"name" db:"name"`
	Description string    `json:"description" form:"description" db:"description"`
	Parent      *int64    `json:"parent" form:"parent" db:"parent"`
	CreatedAt   time.Time `json:"created_at" form:"created_at" db:"created_at"`
}
