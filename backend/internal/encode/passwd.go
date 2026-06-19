package encode

import (
	"golang.org/x/crypto/bcrypt"
)

func EncodePasswd(password string) (string, error) {
	code, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(code), err
}
