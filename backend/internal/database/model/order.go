package model

import "time"

// Order 订单
type Order struct {
	Id        int64     `json:"id" form:"id" db:"id"`
	ItemId    int64     `json:"item_id" form:"item_id" db:"item_id"`
	UserId    int64     `json:"user_id" form:"user_id" db:"user_id"`
	Count     int64     `json:"count" form:"count" db:"count"`
	CreatedAt time.Time `json:"created_at" form:"created_at" db:"created_at"`
}
