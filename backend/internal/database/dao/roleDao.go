package dao

import (
	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/database/model"
)

type RoleDao struct {
	DB *sqlx.DB
}

func (r *RoleDao) SelectAll() ([]model.Role, error) {
	var roles = make([]model.Role, 0)
	err := r.DB.Select(&roles, "select id,name,code,coalesce(description, '') as description,created_at from roles")
	if err != nil {
		return nil, err
	}

	return roles, nil
}

func (r *RoleDao) SelectById(id int64) (*model.Role, error) {
	var role model.Role
	err := r.DB.Get(&role, "select id,name,code,coalesce(description, '') as description,created_at from roles where id = ?", id)
	if err != nil {
		return nil, err
	}

	return &role, nil
}

func (r *RoleDao) SelectByName(name string) (*model.Role, error) {
	var role model.Role
	err := r.DB.Get(&role, "select id,name,code,coalesce(description, '') as description,created_at from roles where name = ?", name)
	if err != nil {
		return nil, err
	}

	return &role, nil
}

func (r *RoleDao) SelectByCode(code string) (*model.Role, error) {
	var role model.Role
	err := r.DB.Get(&role, "select id,name,code,coalesce(description, '') as description,created_at from roles where code = ?", code)
	if err != nil {
		return nil, err
	}

	return &role, nil
}

func (r *RoleDao) DeleteRole(id int64) (int64, error) {
	exec, err := r.DB.Exec("delete from roles where id = ?", id)
	if err != nil {
		return 0, err
	}

	return exec.RowsAffected()
}

func (r *RoleDao) Insert(role *model.Role) (int64, error) {
	statement := `
	INSERT INTO roles(name,code,description)
	values (?,?,?)
`

	exec, err := r.DB.Exec(statement, role.Name, role.Code, role.Description)
	if err != nil {
		return 0, err
	}

	return exec.LastInsertId()
}

func (r *RoleDao) Update(role *model.Role) (int64, error) {
	statement := `
	UPDATE roles
	SET name = ?, code = ?, description = ?
	where id = ?
`

	exec, err := r.DB.Exec(statement, role.Name, role.Code, role.Description, role.Id)
	if err != nil {
		return 0, err
	}

	return exec.RowsAffected()
}
