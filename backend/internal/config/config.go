package config

import "fmt"

type Config struct {
	user     string
	password string
	port     string
	params   string
	Dsn      string
}

// NewConfig 创建新的数据库配置文件比如用户名和密码
func NewConfig(user, password, port, params string) *Config {
	return &Config{user, password, port, params, ""}
}

func (c *Config) Init(dbName string) {
	template := "%s:%s@tcp(127.0.0.1:%s)/%s?%s"
	c.Dsn = fmt.Sprintf(template, c.user, c.password, c.port, dbName, c.params)
}
