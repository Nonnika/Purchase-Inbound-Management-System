package config

type Config struct {
	user     string
	password string
}

// NewConfig 创建新的数据库配置文件比如用户名和密码
func NewConfig(user, password string) *Config {
	return &Config{user, password}
}
