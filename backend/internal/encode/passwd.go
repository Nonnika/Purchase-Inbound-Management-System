package encode

import (
	"golang.org/x/crypto/bcrypt"
)

// EncodePasswd  将密码转换成 Hash
func EncodePasswd(password string) (string, error) {
	code, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(code), err
}
