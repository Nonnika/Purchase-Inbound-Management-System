package model

import "time"

// ItemCategories 物品分类
type ItemCategories struct {
	Id          int64     `json:"id" form:"id" db:"id"`
	Description *string   `json:"description" form:"description" db:"description"`
	Parent      *int64    `json:"parent" form:"parent" db:"parent"`
	CreateAt    time.Time `json:"create_at" form:"create_at" db:"create_at"`
}
