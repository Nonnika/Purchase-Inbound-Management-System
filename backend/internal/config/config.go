package config

import (
	"fmt"

	"github.com/nonnika/pims/internal/database/dao"
	"github.com/nonnika/pims/internal/database/model"
)

type Config struct {
	user     string
	password string
	addr     string
	port     string
	params   string
	Dsn      string
}

// NewConfig 创建新的数据库配置文件比如用户名和密码
func NewConfig(user, password, addr, port, params string) *Config {
	return &Config{user, password, addr, port, params, ""}
}

func (c *Config) Init(dbName string) {
	template := "%s:%s@tcp(%s:%s)/%s?%s"
	c.Dsn = fmt.Sprintf(template, c.user, c.password, c.addr, c.port, dbName, c.params)
}

var roles = []model.Role{
	{Id: 1, Name: "admin", Code: "admin", Description: "管理员角色"},
	{Id: 2, Name: "purchaser", Code: "purchaser", Description: "采购员"},
	{Id: 3, Name: "warehouse", Code: "warehouse", Description: "仓库管理员"},
	{Id: 4, Name: "auditor", Code: "auditor", Description: "审计"},
	{Id: 5, Name: "applicant", Code: "applicant", Description: "申请人"},
}

func InitRoleTable(dao *dao.RoleDao) error {
	rs, err := dao.SelectAll()
	if err != nil {
		return err
	}
	if len(rs) < len(roles) {
		for _, v := range rs {
			_, err := dao.DeleteRole(v.Id)
			if err != nil {
				return err
			}
		}
	}
	for _, v := range roles {
		_, err2 := dao.Insert(&v)
		if err2 != nil {
			return err2
		}
	}
	return nil
}
