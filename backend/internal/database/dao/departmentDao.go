package dao

import (
	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/database/model"
)

type DepartmentDao struct {
	DB *sqlx.DB
}

func (d *DepartmentDao) Insert(department *model.Department) (int64, error) {
	statement := `
	INSERT INTO departments(name,description,parent)
	values (:name,:description,:parent);
`

	exec, err := d.DB.NamedExec(statement, department)
	if err != nil {
		return 0, err
	}
	id, err := exec.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}
