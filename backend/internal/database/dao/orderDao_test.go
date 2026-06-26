package dao

import (
	"encoding/json"
	"testing"

	"github.com/nonnika/pims/internal/database/model"
)

func TestHashPayloadIgnoresObjectKeyOrder(t *testing.T) {
	createdPayload, err := buildOrderEventPayload(&model.Order{
		ItemId:    1,
		UserId:    3,
		Count:     2,
		OrderType: OrderTypePurchase,
	}, nil)
	if err != nil {
		t.Fatalf("buildOrderEventPayload() error = %v", err)
	}

	storedPayload := json.RawMessage(`{"count":2,"item_id":1,"order_type":"PURCHASE","user_id":3}`)

	createdHash, err := hashPayload(createdPayload)
	if err != nil {
		t.Fatalf("hashPayload(createdPayload) error = %v", err)
	}
	storedHash, err := hashPayload(storedPayload)
	if err != nil {
		t.Fatalf("hashPayload(storedPayload) error = %v", err)
	}
	if createdHash != storedHash {
		t.Fatalf("hashPayload() differs by object key order: created = %s, stored = %s", createdHash, storedHash)
	}
}

func TestCanonicalJSONRejectsTrailingValues(t *testing.T) {
	if _, err := canonicalJSON(json.RawMessage(`{} {}`)); err == nil {
		t.Fatal("canonicalJSON() error = nil, want trailing value error")
	}
}
