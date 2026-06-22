package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Role requires the authenticated user's role_id to be one of allowedRoleIds.
func Role(allowedRoleIds ...int64) gin.HandlerFunc {
	allowed := make(map[int64]struct{}, len(allowedRoleIds))
	for _, roleId := range allowedRoleIds {
		allowed[roleId] = struct{}{}
	}

	return func(ctx *gin.Context) {
		roleId, ok := ctx.Get("roleId")
		if !ok {
			ctx.JSON(http.StatusForbidden, gin.H{
				"error": "role is required",
			})
			ctx.Abort()
			return
		}

		role, ok := roleId.(int64)
		if !ok {
			ctx.JSON(http.StatusForbidden, gin.H{
				"error": "invalid role",
			})
			ctx.Abort()
			return
		}

		if _, ok := allowed[role]; !ok {
			ctx.JSON(http.StatusForbidden, gin.H{
				"error": "permission denied",
			})
			ctx.Abort()
			return
		}

		ctx.Next()
	}
}
