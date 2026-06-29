package middleware

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/model"
	"github.com/nonnika/pims/internal/jwt"
)

type AuthUser struct {
	ID       int64
	Username string
	RoleID   int64
	Status   int64
}

type UserValidator func(userID int64) (*AuthUser, error)

func Auth(jwtMgr *jwt.JManager, validators ...UserValidator) gin.HandlerFunc {
	var validator UserValidator
	if len(validators) > 0 {
		validator = validators[0]
	}

	return func(ctx *gin.Context) {
		authHeader := ctx.GetHeader("Authorization")
		if authHeader == "" {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"error": "authorization is empty",
			})
			ctx.Abort()
			return
		}

		token := strings.SplitN(authHeader, " ", 2)
		if !(len(token) == 2 && token[0] == "Bearer") {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid format",
			})
			ctx.Abort()
			return
		}
		claims, err := jwtMgr.ParseToken(token[1])
		if err != nil {
			message := "token is invalid"
			if err.Error() == "token is expired" {
				message = err.Error()
			}
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"error": message,
			})
			ctx.Abort()
			return
		}
		userID := claims.UserId
		roleID := claims.RoleID
		username := claims.UserName
		if validator != nil {
			user, err := validator(claims.UserId)
			if errors.Is(err, sql.ErrNoRows) {
				ctx.JSON(http.StatusUnauthorized, gin.H{
					"error": "user is not authenticated",
				})
				ctx.Abort()
				return
			}
			if err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{
					"error": "failed to validate user",
				})
				ctx.Abort()
				return
			}
			if user == nil {
				ctx.JSON(http.StatusUnauthorized, gin.H{
					"error": "user is not authenticated",
				})
				ctx.Abort()
				return
			}
			if user.Status != model.UserStatusNormal {
				ctx.JSON(http.StatusForbidden, gin.H{
					"error": "user is disabled",
				})
				ctx.Abort()
				return
			}
			userID = user.ID
			roleID = user.RoleID
			username = user.Username
		}
		ctx.Set("user_id", userID)
		ctx.Set("roleId", roleID)
		ctx.Set("username", username)

		ctx.Next()
	}
}
