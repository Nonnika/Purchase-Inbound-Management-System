package dao

import (
	"errors"

	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/database/model"
)

type ItemDao struct {
	DB *sqlx.DB
}

func (i *ItemDao) SelectAll() ([]model.Item, error) {
	items := make([]model.Item, 0)
	err := i.DB.Select(&items, `
		select id,name,category_id,price,item_inventory,frozen_inventory,warehouse_id,warning_level,created_at,updated_at
		from items
		order by id desc
	`)
	return items, err
}

func (i *ItemDao) SelectById(id int64) (*model.Item, error) {
	var item model.Item
	err := i.DB.Get(&item, `
		select id,name,category_id,price,item_inventory,frozen_inventory,warehouse_id,warning_level,created_at,updated_at
		from items
		where id = ?
	`, id)
	return &item, err
}

func (i *ItemDao) Insert(item *model.Item) (int64, error) {
	if item.Name == "" {
		return 0, errors.New("name is required")
	}

	result, err := i.DB.Exec(`
		insert into items(name,category_id,price,item_inventory,frozen_inventory,warehouse_id,warning_level)
		values(?,?,?,?,?,?,?)
	`, item.Name, item.CategoryId, item.Price, normalizeInt64Ptr(item.ItemInventory), normalizeInt64Ptr(item.FrozenInventory), item.WarehouseId, item.WarningLevel)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func normalizeInt64Ptr(value *int64) *int64 {
	if value == nil {
		zero := int64(0)
		return &zero
	}
	return value
}
