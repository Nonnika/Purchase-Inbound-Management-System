package dao

import (
	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/database/model"
)

type UserDao struct {
	DB *sqlx.DB
}

func (u *UserDao) SelectAll() ([]model.User, error) {
	var userRows []model.User
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
