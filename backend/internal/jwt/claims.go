// Package jwt 本包用于处理 JWT 相关的请求
// 如 Token 生成等
package jwt

import (
	"github.com/golang-jwt/jwt/v5"
)

// UserClaims 自定义用户 JWT 声明
type UserClaims struct {
	UserId   int64  `json:"user_id" json:"id"`
	UserName string `json:"username"`
	RoleID   int64  `json:"role_id"`
	jwt.RegisteredClaims
}
