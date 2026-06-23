package jwt

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const minJwtSecretLength = 32

// JManager JWT 管理器
type JManager struct {
	JwtSecret []byte
}

func ValidateSecret(secret []byte) error {
	if len(secret) < minJwtSecretLength {
		return fmt.Errorf("JWT_SECRET must be at least %d bytes", minJwtSecretLength)
	}
	return nil
}

func NewJwtManager(JwtSecret []byte) *JManager {
	return &JManager{
		JwtSecret: JwtSecret,
	}
}

func (j *JManager) GenerateToken(UserID int64, UserName string, RoleID int64) (string, error) {
	if err := ValidateSecret(j.JwtSecret); err != nil {
		return "", err
	}

	expirationTime := time.Now().Add(time.Hour * 48)

	claims := UserClaims{
		UserId:   UserID,
		UserName: UserName,
		RoleID:   RoleID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    os.Getenv("JWT_ISSUER"),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return token.SignedString(j.JwtSecret)
}

func (j *JManager) ParseToken(tokenString string) (*UserClaims, error) {
	if err := ValidateSecret(j.JwtSecret); err != nil {
		return nil, err
	}

	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("token signing method is invalid")
		}
		return j.JwtSecret, nil
	})

	if errors.Is(err, jwt.ErrTokenExpired) {
		return nil, errors.New("token is expired")
	} else if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*UserClaims); ok {
		return claims, nil
	}
	return nil, errors.New("token is invalid")
}
