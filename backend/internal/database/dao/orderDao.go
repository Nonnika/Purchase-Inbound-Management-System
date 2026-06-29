package dao

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"

	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/database/model"
)

const (
	OrderTypePurchase = "PURCHASE"
	OrderTypeOutbound = "OUTBOUND"

	OrderStepPurchaseRequested = "PURCHASE_REQUESTED"
	OrderStepOutboundRequested = "OUTBOUND_REQUESTED"
	OrderStepAuditApproved     = "AUDIT_APPROVED"
	OrderStepAuditRejected     = "AUDIT_REJECTED"
	OrderStepWarehouseReceived = "WAREHOUSE_RECEIVED"
	OrderStepWarehouseShipped  = "WAREHOUSE_SHIPPED"
	OrderStepDeleted           = "ORDER_DELETED"
)

var validOrderSteps = map[string]struct{}{
	OrderStepPurchaseRequested: {},
	OrderStepOutboundRequested: {},
	OrderStepAuditApproved:     {},
	OrderStepAuditRejected:     {},
	OrderStepWarehouseReceived: {},
	OrderStepWarehouseShipped:  {},
	OrderStepDeleted:           {},
}

var validOrderTypes = map[string]struct{}{
	OrderTypePurchase: {},
	OrderTypeOutbound: {},
}

var validOrderTransitions = map[string]map[string]map[string]struct{}{
	OrderTypePurchase: {
		OrderStepPurchaseRequested: {
			OrderStepAuditApproved: {},
			OrderStepAuditRejected: {},
			OrderStepDeleted:       {},
		},
		OrderStepAuditApproved: {
			OrderStepWarehouseReceived: {},
			OrderStepDeleted:           {},
		},
		OrderStepAuditRejected: {
			OrderStepDeleted: {},
		},
	},
	OrderTypeOutbound: {
		OrderStepOutboundRequested: {
			OrderStepAuditApproved: {},
			OrderStepAuditRejected: {},
			OrderStepDeleted:       {},
		},
		OrderStepAuditApproved: {
			OrderStepWarehouseShipped: {},
			OrderStepDeleted:          {},
		},
		OrderStepAuditRejected: {
			OrderStepDeleted: {},
		},
	},
}

type OrderDao struct {
	DB *sqlx.DB
}

type ChainVerifyResult struct {
	Valid bool   `json:"valid"`
	Error string `json:"error,omitempty"`
}

func (o *OrderDao) SelectAll() ([]model.Order, error) {
	orders := make([]model.Order, 0)
	err := o.DB.Select(&orders, "select id,item_id,user_id,count,order_type,status,created_at,updated_at from orders order by created_at desc")
	return orders, err
}

func (o *OrderDao) SelectPage(page, pageSize int64) ([]model.Order, int64, error) {
	orders := make([]model.Order, 0)
	err := o.DB.Select(&orders, "select id,item_id,user_id,count,order_type,status,created_at,updated_at from orders order by created_at desc limit ? offset ?", pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, err
	}

	var total int64
	if err := o.DB.Get(&total, "select count(*) from orders"); err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

func (o *OrderDao) SelectById(id int64) (*model.Order, error) {
	var order model.Order
	err := o.DB.Get(&order, "select id,item_id,user_id,count,order_type,status,created_at,updated_at from orders where id = ?", id)
	return &order, err
}

func (o *OrderDao) SelectByUserId(userId int64) ([]model.Order, error) {
	orders := make([]model.Order, 0)
	err := o.DB.Select(&orders, "select id,item_id,user_id,count,order_type,status,created_at,updated_at from orders where user_id = ? order by created_at desc", userId)
	return orders, err
}

func (o *OrderDao) DeleteById(orderId int64, operatorUserId *int64) (int64, error) {
	if _, err := o.AppendEvent(orderId, OrderStepDeleted, operatorUserId, nil); err != nil {
		return 0, err
	}
	return 1, nil
}

func (o *OrderDao) SelectEventsByOrderId(orderId int64) ([]model.OrderEvent, error) {
	events := make([]model.OrderEvent, 0)
	err := o.DB.Select(&events, `
		select id,order_id,sequence_no,step,operator_user_id,event_payload,payload_hash,previous_event_hash,event_hash,created_at
		from order_events
		where order_id = ?
		order by sequence_no asc
	`, orderId)
	return events, err
}

func (o *OrderDao) Create(order *model.Order, operatorUserId *int64, payload json.RawMessage) (*model.OrderEvent, error) {
	if order.ItemId <= 0 || order.UserId <= 0 || order.Count <= 0 {
		return nil, errors.New("invalid order")
	}
	if _, ok := validOrderTypes[order.OrderType]; !ok {
		return nil, errors.New("invalid order type")
	}
	initialStep := initialStepByOrderType(order.OrderType)

	tx, err := o.DB.Beginx()
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(tx)

	result, err := tx.Exec("insert into orders(item_id,user_id,count,order_type,status) values(?,?,?,?,?)", order.ItemId, order.UserId, order.Count, order.OrderType, initialStep)
	if err != nil {
		return nil, err
	}

	orderId, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	order.Id = orderId
	order.Status = initialStep

	eventPayload, err := buildOrderEventPayload(order, payload)
	if err != nil {
		return nil, err
	}

	event, err := insertOrderEvent(tx, order.Id, 1, initialStep, operatorUserId, eventPayload, nil)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return event, nil
}

func buildOrderEventPayload(order *model.Order, payload json.RawMessage) (json.RawMessage, error) {
	eventPayload := map[string]any{
		"item_id":    order.ItemId,
		"user_id":    order.UserId,
		"count":      order.Count,
		"order_type": order.OrderType,
	}
	if len(bytes.TrimSpace(payload)) == 0 {
		return json.Marshal(eventPayload)
	}

	metadata, err := decodeJSONValue(payload)
	if err != nil {
		return nil, err
	}
	eventPayload["metadata"] = metadata
	return json.Marshal(eventPayload)
}

func (o *OrderDao) AppendEvent(orderId int64, step string, operatorUserId *int64, payload json.RawMessage) (*model.OrderEvent, error) {
	if _, ok := validOrderSteps[step]; !ok {
		return nil, errors.New("invalid order step")
	}
	if step == OrderStepPurchaseRequested || step == OrderStepOutboundRequested {
		return nil, errors.New("requested event is only allowed when creating order")
	}

	tx, err := o.DB.Beginx()
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(tx)

	var order model.Order
	if err := tx.Get(&order, "select id,item_id,user_id,count,order_type,status,created_at,updated_at from orders where id = ? for update", orderId); err != nil {
		return nil, err
	}
	if !canTransitOrderStep(order.OrderType, order.Status, step) {
		return nil, errors.New("invalid order status transition")
	}
	if err := applyInventoryChange(tx, &order, step); err != nil {
		return nil, err
	}

	var last model.OrderEvent
	err = tx.Get(&last, `
		select id,order_id,sequence_no,step,operator_user_id,event_payload,payload_hash,previous_event_hash,event_hash,created_at
		from order_events
		where order_id = ?
		order by sequence_no desc
		limit 1
		for update
	`, orderId)
	if err != nil {
		return nil, err
	}

	event, err := insertOrderEvent(tx, orderId, last.SequenceNo+1, step, operatorUserId, payload, &last.EventHash)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec("update orders set status = ? where id = ?", step, orderId); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return event, nil
}

func applyInventoryChange(tx *sqlx.Tx, order *model.Order, step string) error {
	switch {
	case order.OrderType == OrderTypeOutbound && step == OrderStepAuditApproved:
		return freezeOutboundInventory(tx, order)
	case order.OrderType == OrderTypeOutbound && step == OrderStepWarehouseShipped:
		return shipOutboundInventory(tx, order)
	case order.OrderType == OrderTypePurchase && step == OrderStepWarehouseReceived:
		return receivePurchaseInventory(tx, order)
	case order.OrderType == OrderTypeOutbound && order.Status == OrderStepAuditApproved && step == OrderStepDeleted:
		return releaseOutboundInventory(tx, order)
	default:
		return nil
	}
}

func freezeOutboundInventory(tx *sqlx.Tx, order *model.Order) error {
	result, err := tx.Exec(`
		update items
		set frozen_inventory = coalesce(frozen_inventory, 0) + ?,
		    updated_at = current_timestamp
		where id = ?
		  and coalesce(item_inventory, 0) - coalesce(frozen_inventory, 0) >= ?
	`, order.Count, order.ItemId, order.Count)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("insufficient available inventory")
	}
	return nil
}

func shipOutboundInventory(tx *sqlx.Tx, order *model.Order) error {
	result, err := tx.Exec(`
		update items
		set item_inventory = coalesce(item_inventory, 0) - ?,
		    frozen_inventory = coalesce(frozen_inventory, 0) - ?,
		    updated_at = current_timestamp
		where id = ?
		  and coalesce(item_inventory, 0) >= ?
		  and coalesce(frozen_inventory, 0) >= ?
	`, order.Count, order.Count, order.ItemId, order.Count, order.Count)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("insufficient frozen inventory")
	}
	return nil
}

func releaseOutboundInventory(tx *sqlx.Tx, order *model.Order) error {
	result, err := tx.Exec(`
		update items
		set frozen_inventory = coalesce(frozen_inventory, 0) - ?,
		    updated_at = current_timestamp
		where id = ?
		  and coalesce(frozen_inventory, 0) >= ?
	`, order.Count, order.ItemId, order.Count)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("insufficient frozen inventory")
	}
	return nil
}

func receivePurchaseInventory(tx *sqlx.Tx, order *model.Order) error {
	result, err := tx.Exec(`
		update items
		set item_inventory = coalesce(item_inventory, 0) + ?,
		    frozen_inventory = coalesce(frozen_inventory, 0),
		    updated_at = current_timestamp
		where id = ?
	`, order.Count, order.ItemId)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("item is not exist")
	}
	return nil
}

func (o *OrderDao) VerifyChain(orderId int64) (*ChainVerifyResult, error) {
	events, err := o.SelectEventsByOrderId(orderId)
	if err != nil {
		return nil, err
	}
	if len(events) == 0 {
		return &ChainVerifyResult{Valid: false, Error: "order events is empty"}, nil
	}

	var previousHash *string
	for index, event := range events {
		expectedSequenceNo := int64(index + 1)
		if event.SequenceNo != expectedSequenceNo {
			return &ChainVerifyResult{Valid: false, Error: "sequence number mismatch"}, nil
		}

		payloadHash, err := hashPayload(event.EventPayload)
		if err != nil {
			return &ChainVerifyResult{Valid: false, Error: err.Error()}, nil
		}
		if event.PayloadHash != payloadHash {
			return &ChainVerifyResult{Valid: false, Error: "payload hash mismatch"}, nil
		}
		if !sameStringPtr(event.PreviousEventHash, previousHash) {
			return &ChainVerifyResult{Valid: false, Error: "previous event hash mismatch"}, nil
		}

		eventHash, err := hashEvent(event.OrderId, event.SequenceNo, event.Step, event.OperatorUserId, payloadHash, event.PreviousEventHash)
		if err != nil {
			return nil, err
		}
		if event.EventHash != eventHash {
			return &ChainVerifyResult{Valid: false, Error: "event hash mismatch"}, nil
		}

		currentHash := event.EventHash
		previousHash = &currentHash
	}

	return &ChainVerifyResult{Valid: true}, nil
}

func initialStepByOrderType(orderType string) string {
	if orderType == OrderTypeOutbound {
		return OrderStepOutboundRequested
	}
	return OrderStepPurchaseRequested
}

func canTransitOrderStep(orderType string, current string, next string) bool {
	transitions, ok := validOrderTransitions[orderType]
	if !ok {
		return false
	}
	allowedNext, ok := transitions[current]
	if !ok {
		return false
	}
	_, ok = allowedNext[next]
	return ok
}

func insertOrderEvent(tx *sqlx.Tx, orderId int64, sequenceNo int64, step string, operatorUserId *int64, payload json.RawMessage, previousEventHash *string) (*model.OrderEvent, error) {
	payloadHash, err := hashPayload(payload)
	if err != nil {
		return nil, err
	}
	eventHash, err := hashEvent(orderId, sequenceNo, step, operatorUserId, payloadHash, previousEventHash)
	if err != nil {
		return nil, err
	}
	canonicalPayload, err := canonicalJSON(payload)
	if err != nil {
		return nil, err
	}

	result, err := tx.Exec(`
		insert into order_events(order_id,sequence_no,step,operator_user_id,event_payload,payload_hash,previous_event_hash,event_hash)
		values(?,?,?,?,?,?,?,?)
	`, orderId, sequenceNo, step, operatorUserId, canonicalPayload, payloadHash, previousEventHash, eventHash)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	var event model.OrderEvent
	err = tx.Get(&event, `
		select id,order_id,sequence_no,step,operator_user_id,event_payload,payload_hash,previous_event_hash,event_hash,created_at
		from order_events
		where id = ?
	`, id)
	return &event, err
}

func hashPayload(payload json.RawMessage) (string, error) {
	canonicalPayload, err := canonicalJSON(payload)
	if err != nil {
		return "", err
	}
	return sha256Hex(canonicalPayload), nil
}

func hashEvent(orderId int64, sequenceNo int64, step string, operatorUserId *int64, payloadHash string, previousEventHash *string) (string, error) {
	source, err := json.Marshal(struct {
		OrderId           int64   `json:"order_id"`
		SequenceNo        int64   `json:"sequence_no"`
		Step              string  `json:"step"`
		OperatorUserId    *int64  `json:"operator_user_id"`
		PayloadHash       string  `json:"payload_hash"`
		PreviousEventHash *string `json:"previous_event_hash"`
	}{
		OrderId:           orderId,
		SequenceNo:        sequenceNo,
		Step:              step,
		OperatorUserId:    operatorUserId,
		PayloadHash:       payloadHash,
		PreviousEventHash: previousEventHash,
	})
	if err != nil {
		return "", err
	}
	return sha256Hex(source), nil
}

func canonicalJSON(payload json.RawMessage) ([]byte, error) {
	if len(bytes.TrimSpace(payload)) == 0 {
		return []byte("{}"), nil
	}

	value, err := decodeJSONValue(payload)
	if err != nil {
		return nil, err
	}

	return json.Marshal(value)
}

func decodeJSONValue(payload json.RawMessage) (any, error) {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.UseNumber()

	var value any
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}

	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return nil, errors.New("invalid json payload")
		}
		return nil, err
	}

	return value, nil
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func sameStringPtr(a *string, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func rollbackUnlessCommitted(tx *sqlx.Tx) {
	if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
		return
	}
}
