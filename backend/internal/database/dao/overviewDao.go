package dao

import (
	"time"

	"github.com/jmoiron/sqlx"
)

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

// OrderTrendBucket 订单趋势单日聚合数据
type OrderTrendBucket struct {
	Date  string `json:"date" db:"date"`
	Count int64  `json:"count" db:"count"`
}

// OrderTrend HomePage 订单趋势数据
type OrderTrend struct {
	Days    int                `json:"days"`
	Buckets []OrderTrendBucket `json:"buckets"`
}

// CargoByWarehouseRow 单仓货值聚合数据
type CargoByWarehouseRow struct {
	WarehouseID int64   `json:"warehouse_id" db:"warehouse_id"`
	Name        string  `json:"name" db:"name"`
	Sum         float64 `json:"sum" db:"sum"`
}

// CargoByWarehouse HomePage 仓库货值分布数据
type CargoByWarehouse struct {
	Warehouses []CargoByWarehouseRow `json:"warehouses"`
	Total      float64               `json:"total"`
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

// OrderTrend 返回最近 days 天内未软删订单的每日新建数量
func (o *OverviewDao) OrderTrend(days int) (*OrderTrend, error) {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	start := today.AddDate(0, 0, -days+1)
	end := today.AddDate(0, 0, 1)

	rows := make([]OrderTrendBucket, 0)
	err := o.DB.Select(&rows, `
		select date_format(created_at, '%Y-%m-%d') as date, count(*) as count
		from orders
		where status <> ? and created_at >= ? and created_at < ?
		group by date_format(created_at, '%Y-%m-%d')
		order by date asc
	`, OrderStepDeleted, start, end)
	if err != nil {
		return nil, err
	}

	countByDate := make(map[string]int64, len(rows))
	for _, row := range rows {
		countByDate[row.Date] = row.Count
	}

	buckets := make([]OrderTrendBucket, 0, days)
	for day := 0; day < days; day++ {
		date := start.AddDate(0, 0, day).Format(time.DateOnly)
		buckets = append(buckets, OrderTrendBucket{
			Date:  date,
			Count: countByDate[date],
		})
	}

	return &OrderTrend{
		Days:    days,
		Buckets: buckets,
	}, nil
}

// CargoByWarehouse 返回各仓库按 CalSum 口径统计的货值分布
func (o *OverviewDao) CargoByWarehouse() (*CargoByWarehouse, error) {
	warehouses := make([]CargoByWarehouseRow, 0)
	err := o.DB.Select(&warehouses, `
		select
			w.id as warehouse_id,
			w.name as name,
			coalesce(sum(
				case
					when i.price is not null and i.item_inventory is not null then i.price * i.item_inventory
					else 0
				end
			), 0) as sum
		from warehouses w
		left join items i on i.warehouse_id = w.id
		group by w.id, w.name
		order by w.id asc
	`)
	if err != nil {
		return nil, err
	}

	var total float64
	for _, warehouse := range warehouses {
		total += warehouse.Sum
	}

	return &CargoByWarehouse{
		Warehouses: warehouses,
		Total:      total,
	}, nil
}
