package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
	"github.com/nonnika/pims/internal/database/model"
	"github.com/nonnika/pims/internal/jwt"
	"github.com/nonnika/pims/internal/middleware"
)

func TestItemWriteRoutesRejectAuditor(t *testing.T) {
	gin.SetMode(gin.TestMode)

	jwtMgr := jwt.NewJwtManager([]byte("test-secret-with-at-least-32-bytes"))
	token, err := jwtMgr.GenerateToken(1, "auditor", model.RoleAuditor)
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	router := gin.New()
	api := router.Group("/api")
	auth := api.Group("")
	auth.Use(middleware.Auth(jwtMgr))
	NewItemController(&dao.ItemDao{}).RegisterAuthRouter(auth)

	tests := []struct {
		method string
		path   string
	}{
		{method: http.MethodPost, path: "/api/items/update"},
		{method: http.MethodDelete, path: "/api/items/delete"},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			request := httptest.NewRequest(tt.method, tt.path, nil)
			request.Header.Set("Authorization", "Bearer "+token)
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusForbidden {
				t.Fatalf("status code = %d, want %d, body = %s", recorder.Code, http.StatusForbidden, recorder.Body.String())
			}
		})
	}
}
