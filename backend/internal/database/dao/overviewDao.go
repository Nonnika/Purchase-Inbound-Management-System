package dao

import "github.com/jmoiron/sqlx"

// OverviewDao 用于 HomePage 概览统计
type OverviewDao struct {
	DB *sqlx.DB
}

// OverviewSummary HomePage 概览汇总数据
type OverviewSummary struct {
	ItemTotal          int64 `json:"item_total" db:"item_total"`
	LowInventoryCount  int64 `json:"low_inventory_count" db:"low_inventory_count"`
	PendingAudit       int64 `json:"pending_audit" db:"pending_audit"`
	PurchaseRequesting int64 `json:"purchase_requesting" db:"purchase_requesting"`
	OutboundRequesting int64 `json:"outbound_requesting" db:"outbound_requesting"`
	AuditApproved      int64 `json:"audit_approved" db:"audit_approved"`
	AuditRejected      int64 `json:"audit_rejected" db:"audit_rejected"`
	WarehouseReceived  int64 `json:"warehouse_received" db:"warehouse_received"`
	WarehouseShipped   int64 `json:"warehouse_shipped" db:"warehouse_shipped"`
}

// Summary 返回 HomePage 所需的各类数量统计
func (o *OverviewDao) Summary() (*OverviewSummary, error) {
	var summary OverviewSummary
	err := o.DB.Get(&summary, `
		select
			(select count(*) from items) as item_total,
			(select count(*) from items where warning_level is not null and coalesce(item_inventory, 0) <= warning_level) as low_inventory_count,
			(select count(*) from orders where status in (?, ?)) as pending_audit,
			(select count(*) from orders where status = ?) as purchase_requesting,
			(select count(*) from orders where status = ?) as outbound_requesting,
			(select count(*) from orders where status = ?) as audit_approved,
			(select count(*) from orders where status = ?) as audit_rejected,
			(select count(*) from orders where status = ?) as warehouse_received,
			(select count(*) from orders where status = ?) as warehouse_shipped
	`, OrderStepPurchaseRequested, OrderStepOutboundRequested, OrderStepPurchaseRequested, OrderStepOutboundRequested, OrderStepAuditApproved, OrderStepAuditRejected, OrderStepWarehouseReceived, OrderStepWarehouseShipped)
	if err != nil {
		return nil, err
	}
	return &summary, nil
}
