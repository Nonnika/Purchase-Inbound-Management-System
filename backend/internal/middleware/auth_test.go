package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/model"
	"github.com/nonnika/pims/internal/jwt"
)

func TestAuthRejectsDisabledUserFromValidator(t *testing.T) {
	router, token := authTestRouter(t, func(userID int64) (*AuthUser, error) {
		return &AuthUser{
			ID:       userID,
			Username: "disabled",
			RoleID:   model.RoleAdmin,
			Status:   model.UserStatusBlocked,
		}, nil
	})

	recorder := serveAuthTest(router, token)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status code = %d, want %d, body = %s", recorder.Code, http.StatusForbidden, recorder.Body.String())
	}
}

func TestAuthUsesCurrentRoleFromValidator(t *testing.T) {
	router, token := authTestRouter(t, func(userID int64) (*AuthUser, error) {
		return &AuthUser{
			ID:       userID,
			Username: "demoted",
			RoleID:   model.RoleApplicant,
			Status:   model.UserStatusNormal,
		}, nil
	})

	recorder := serveAuthTest(router, token)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status code = %d, want %d, body = %s", recorder.Code, http.StatusForbidden, recorder.Body.String())
	}
}

func authTestRouter(t *testing.T, validator UserValidator) (*gin.Engine, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	jwtMgr := jwt.NewJwtManager([]byte("test-secret-with-at-least-32-bytes"))
	token, err := jwtMgr.GenerateToken(1, "admin", model.RoleAdmin)
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	router := gin.New()
	group := router.Group("/")
	group.Use(Auth(jwtMgr, validator))
	group.GET("/admin", Role(model.RoleAdmin), func(ctx *gin.Context) {
		ctx.Status(http.StatusOK)
	})
	return router, token
}

func serveAuthTest(router *gin.Engine, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodGet, "/admin", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}
