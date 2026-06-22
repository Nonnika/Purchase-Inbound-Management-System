package model

import "time"

// Item 商品
type Item struct {
	Id              int64     `json:"id" form:"id" db:"id"`
	Name            string    `json:"name" form:"name" db:"name"`
	CategoryId      *int64    `json:"category_id" form:"category_id" db:"category_id"`
	Price           *float64  `json:"price" form:"price" db:"price"`
	ItemInventory   *int64    `json:"item_inventory" form:"item_inventory" db:"item_inventory"`
	FrozenInventory *int64    `json:"frozen_inventory" form:"frozen_inventory" db:"frozen_inventory"`
	WarehouseId     *int64    `json:"warehouse_id" form:"warehouse_id" db:"warehouse_id"`
	WarningLevel    *int64    `json:"warning_level" form:"warning_level" db:"warning_level"`
	CreatedAt       time.Time `json:"created_at" form:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" form:"updated_at" db:"updated_at"`
}
