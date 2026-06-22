package dao

import (
	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/database/model"
)

type UserDao struct {
	DB *sqlx.DB
}

func (u *UserDao) SelectAll() ([]model.User, error) {
	var userRows = make([]model.User, 0)
	err := u.DB.Select(&userRows, "select * from users")
	if err != nil {
		return nil, err
	}

	return userRows, nil
}

func (u *UserDao) SelectById(id int) (*model.User, error) {
	var userRow model.User
	err := u.DB.Get(&userRow, "select * from users where id = ?", id)
	if err != nil {
		return nil, err
	}
	return &userRow, nil
}

func (u *UserDao) SelectByUserName(username string) (*model.User, error) {
	var userRow model.User
	err := u.DB.Get(&userRow, "select * from users where username = ?", username)
	return &userRow, err
}

func (u *UserDao) DeleteUser(id int) (int64, error) {
	exec, err := u.DB.Exec("delete from users where id = ?", id)
	if err != nil {
		return 0, err
	}
	return exec.RowsAffected()
}

func (u *UserDao) Insert(user model.User) (int64, error) {
	stat := `
	INSERT INTO users(username, password_hash, real_name, phone, role_id, department_id) 
	VALUES(?, ?, ?, ?, ?, ?)`

	exec, err := u.DB.Exec(stat, user.Username, user.PasswordHash, user.RealName, user.Phone, user.RoleId, user.DepartmentId)
	if err != nil {
		return 0, err
	}
	execID, err := exec.RowsAffected()
	if err != nil {
		return 0, err
	}
	return execID, nil
}

// Update 不稳定
func (u *UserDao) Update(user *model.User) (int64, error) {
	query := `
	UPDATE users
	SET username=:username,real_name=:real_name,phone=:phone,role_id=:role_id,department_id=:department_id,password_hash=:password_hash
	where id=:id
`
	exec, err := u.DB.NamedExec(query, user)
	if err != nil {
		return 0, err
	}
	return exec.RowsAffected()
}
