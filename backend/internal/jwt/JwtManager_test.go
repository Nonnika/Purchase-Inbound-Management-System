package jwt

import "testing"

func TestJwtManagerRejectsShortSecret(t *testing.T) {
	manager := NewJwtManager([]byte("short"))

	if _, err := manager.GenerateToken(1, "admin", 1); err == nil {
		t.Fatal("GenerateToken() error = nil, want short secret error")
	}

	if _, err := manager.ParseToken("not-a-token"); err == nil {
		t.Fatal("ParseToken() error = nil, want short secret error")
	}
}

func TestJwtManagerAcceptsLongSecret(t *testing.T) {
	manager := NewJwtManager([]byte("test-secret-with-at-least-32-bytes"))

	token, err := manager.GenerateToken(1, "admin", 1)
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	claims, err := manager.ParseToken(token)
	if err != nil {
		t.Fatalf("ParseToken() error = %v", err)
	}
	if claims.UserId != 1 || claims.UserName != "admin" || claims.RoleID != 1 {
		t.Fatalf("claims = %#v, want user id/name/role", claims)
	}
}
