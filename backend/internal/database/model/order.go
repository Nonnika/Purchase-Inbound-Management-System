package model

import (
	"encoding/json"
	"time"
)

// Order 订单
type Order struct {
	Id        int64     `json:"id" form:"id" db:"id"`
	ItemId    int64     `json:"item_id" form:"item_id" db:"item_id"`
	UserId    int64     `json:"user_id" form:"user_id" db:"user_id"`
	Count     int64     `json:"count" form:"count" db:"count"`
	OrderType string    `json:"order_type" form:"order_type" db:"order_type"`
	Status    string    `json:"status" form:"status" db:"status"`
	CreatedAt time.Time `json:"created_at" form:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" form:"updated_at" db:"updated_at"`
}

// OrderEvent 订单事件哈希链节点
type OrderEvent struct {
	Id                int64           `json:"id" db:"id"`
	OrderId           int64           `json:"order_id" db:"order_id"`
	SequenceNo        int64           `json:"sequence_no" db:"sequence_no"`
	Step              string          `json:"step" db:"step"`
	OperatorUserId    *int64          `json:"operator_user_id" db:"operator_user_id"`
	EventPayload      json.RawMessage `json:"event_payload" db:"event_payload"`
	PayloadHash       string          `json:"payload_hash" db:"payload_hash"`
	PreviousEventHash *string         `json:"previous_event_hash" db:"previous_event_hash"`
	EventHash         string          `json:"event_hash" db:"event_hash"`
	CreatedAt         time.Time       `json:"created_at" db:"created_at"`
}
