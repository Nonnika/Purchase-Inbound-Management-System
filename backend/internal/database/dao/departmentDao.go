package dao

import (
	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/database/model"
)

type DepartmentDao struct {
	DB *sqlx.DB
}

func (d *DepartmentDao) SelectAll() ([]model.Department, error) {
	var departments = make([]model.Department, 0)
	err := d.DB.Select(&departments, "select id,name,description,parent,created_at from departments")
	if err != nil {
		return nil, err
	}

	return departments, nil
}

func (d *DepartmentDao) SelectById(id int64) (*model.Department, error) {
	var department model.Department
	err := d.DB.Get(&department, "select id,name,description,parent,created_at from departments where id = ?", id)
	if err != nil {
		return nil, err
	}
	return &department, nil
}

func (d *DepartmentDao) SelectByName(name string) (*model.Department, error) {
	var department model.Department
	err := d.DB.Get(&department, "select id,name,description,parent,created_at from departments where name = ?", name)
	if err != nil {
		return nil, err
	}
	return &department, nil
}

func (d *DepartmentDao) DeleteDepartment(id int64) (int64, error) {
	exec, err := d.DB.Exec("delete from departments where id = ?", id)
	if err != nil {
		return 0, err
	}
	return exec.RowsAffected()
}

func (d *DepartmentDao) Insert(department *model.Department) (int64, error) {
	statement := `
	INSERT INTO departments(name,description,parent)
	values (?,?,?);
`

	exec, err := d.DB.Exec(statement, department.Name, department.Description, department.Parent)
	if err != nil {
		return 0, err
	}
	id, err := exec.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (d *DepartmentDao) Update(department *model.Department) (int64, error) {
	statement := `
	UPDATE departments
	SET name = ?, description = ?, parent = ?
	where id = ?
`

	exec, err := d.DB.Exec(statement, department.Name, department.Description, department.Parent, department.Id)
	if err != nil {
		return 0, err
	}
	return exec.RowsAffected()
}
