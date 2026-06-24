package dao

import (
	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/database/model"
)

type WarehouseDao struct {
	DB *sqlx.DB
}

func (w *WarehouseDao) SelectAll() ([]model.Warehouse, error) {
	var warehouses = make([]model.Warehouse, 0)
	err := w.DB.Select(&warehouses, "select id,name,description,create_at from warehouses")
	if err != nil {
		return nil, err
	}

	return warehouses, nil
}

func (w *WarehouseDao) SelectPage(page, pageSize int64) ([]model.Warehouse, int64, error) {
	warehouses := make([]model.Warehouse, 0)
	err := w.DB.Select(&warehouses, "select id,name,description,create_at from warehouses order by id desc limit ? offset ?", pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, err
	}

	var total int64
	if err := w.DB.Get(&total, "select count(*) from warehouses"); err != nil {
		return nil, 0, err
	}

	return warehouses, total, nil
}

func (w *WarehouseDao) SelectById(id int64) (*model.Warehouse, error) {
	var warehouse model.Warehouse
	err := w.DB.Get(&warehouse, "select id,name,description,create_at from warehouses where id = ?", id)
	if err != nil {
		return nil, err
	}
	return &warehouse, nil
}

func (w *WarehouseDao) SelectByName(name string) (*model.Warehouse, error) {
	var warehouse model.Warehouse
	err := w.DB.Get(&warehouse, "select id,name,description,create_at from warehouses where name = ?", name)
	if err != nil {
		return nil, err
	}
	return &warehouse, nil
}

func (w *WarehouseDao) DeleteWarehouse(id int64) (int64, error) {
	exec, err := w.DB.Exec("delete from warehouses where id = ?", id)
	if err != nil {
		return 0, err
	}
	return exec.RowsAffected()
}

func (w *WarehouseDao) Insert(warehouse *model.Warehouse) (int64, error) {
	statement := `
	INSERT INTO warehouses(name,description)
	values (?,?);
`

	exec, err := w.DB.Exec(statement, warehouse.Name, warehouse.Description)
	if err != nil {
		return 0, err
	}
	id, err := exec.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (w *WarehouseDao) Update(warehouse *model.Warehouse) (int64, error) {
	statement := `
	UPDATE warehouses
	SET name = ?, description = ?
	where id = ?
`

	exec, err := w.DB.Exec(statement, warehouse.Name, warehouse.Description, warehouse.Id)
	if err != nil {
		return 0, err
	}
	return exec.RowsAffected()
}
