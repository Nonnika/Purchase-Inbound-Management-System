package model

import "time"

type Department struct {
	Id          int64     `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Parent      int64     `json:"parent" db:"parent"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}
