package dao

import (
	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/database/model"
)

type ItemCategoriesDao struct {
	DB *sqlx.DB
}

func (c *ItemCategoriesDao) SelectAll() ([]model.ItemCategories, error) {
	var categories = make([]model.ItemCategories, 0)
	err := c.DB.Select(&categories, "select id,name,description,parent,created_at from item_categories")
	if err != nil {
		return nil, err
	}

	return categories, nil
}

func (c *ItemCategoriesDao) SelectPage(page, pageSize int64) ([]model.ItemCategories, int64, error) {
	categories := make([]model.ItemCategories, 0)
	err := c.DB.Select(&categories, "select id,name,description,parent,created_at from item_categories order by id desc limit ? offset ?", pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, err
	}

	var total int64
	if err := c.DB.Get(&total, "select count(*) from item_categories"); err != nil {
		return nil, 0, err
	}

	return categories, total, nil
}

func (c *ItemCategoriesDao) SelectById(id int64) (*model.ItemCategories, error) {
	var category model.ItemCategories
	err := c.DB.Get(&category, "select id,name,description,parent,created_at from item_categories where id = ?", id)
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (c *ItemCategoriesDao) SelectByName(name string) (*model.ItemCategories, error) {
	var category model.ItemCategories
	err := c.DB.Get(&category, "select id,name,description,parent,created_at from item_categories where name = ?", name)
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (c *ItemCategoriesDao) DeleteCategory(id int64) (int64, error) {
	exec, err := c.DB.Exec("delete from item_categories where id = ?", id)
	if err != nil {
		return 0, err
	}
	return exec.RowsAffected()
}

func (c *ItemCategoriesDao) Insert(category *model.ItemCategories) (int64, error) {
	statement := `
	INSERT INTO item_categories(name,description,parent)
	values (?,?,?);
`

	exec, err := c.DB.Exec(statement, category.Name, category.Description, category.Parent)
	if err != nil {
		return 0, err
	}
	id, err := exec.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (c *ItemCategoriesDao) Update(category *model.ItemCategories) (int64, error) {
	statement := `
	UPDATE item_categories
	SET name = ?, description = ?, parent = ?
	where id = ?
`

	exec, err := c.DB.Exec(statement, category.Name, category.Description, category.Parent, category.Id)
	if err != nil {
		return 0, err
	}
	return exec.RowsAffected()
}
