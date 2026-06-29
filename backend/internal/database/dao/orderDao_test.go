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

func TestBuildOrderEventPayloadKeepsServerOrderFieldsAuthoritative(t *testing.T) {
	payload, err := buildOrderEventPayload(&model.Order{
		ItemId:    1,
		UserId:    3,
		Count:     2,
		OrderType: OrderTypePurchase,
	}, json.RawMessage(`{"item_id":999,"count":100,"note":"client data"}`))
	if err != nil {
		t.Fatalf("buildOrderEventPayload() error = %v", err)
	}

	var body struct {
		ItemId    int64          `json:"item_id"`
		UserId    int64          `json:"user_id"`
		Count     int64          `json:"count"`
		OrderType string         `json:"order_type"`
		Metadata  map[string]any `json:"metadata"`
	}
	if err := json.Unmarshal(payload, &body); err != nil {
		t.Fatalf("payload is not valid json: %v", err)
	}

	if body.ItemId != 1 || body.UserId != 3 || body.Count != 2 || body.OrderType != OrderTypePurchase {
		t.Fatalf("server fields were not authoritative: %#v", body)
	}
	if body.Metadata["note"] != "client data" {
		t.Fatalf("metadata note = %#v, want client data", body.Metadata["note"])
	}
	if body.Metadata["item_id"] == nil {
		t.Fatal("metadata did not preserve client-provided item_id")
	}
}
