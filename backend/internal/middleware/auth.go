package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/jwt"
)

func Auth(jwtMgr *jwt.JManager) gin.HandlerFunc {

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
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"error": err.Error(),
			})
			ctx.Abort()
			return
		}
		ctx.Set("user_id", claims.UserId)
		ctx.Set("roleId", claims.RoleID)
		ctx.Set("username", claims.UserName)

		ctx.Next()
	}
}
