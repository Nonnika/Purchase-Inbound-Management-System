package encode

import (
	"golang.org/x/crypto/bcrypt"
)

// EncodePasswd  将密码转换成 Hash
func EncodePasswd(password string) (string, error) {
	code, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(code), err
}

func CompareHashAndPassword(hash string, passwd string) bool {
	err := bcrypt.CompareHashAndPassword(
		[]byte(hash),
		[]byte(passwd),
	)

	return err == nil
}
