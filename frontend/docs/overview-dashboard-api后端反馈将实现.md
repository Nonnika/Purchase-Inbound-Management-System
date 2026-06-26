

## 3. 需后端新增的 API

### 3.1（必需）订单趋势聚合 — `GET /overview/orderTrend`

**背景**：`orders/selectAll` 仅对 admin/auditor/warehouse 开放（见 `orderController.go RegisterAuthRouter`）。purchaser(2) / applicant(5) 无法拉订单，导致「14 天趋势」对这两个角色无法实现。而该模块是仪表盘核心，应全角色可见。故需一个与 `/overview/summary` 同级、对**任意登录角色开放**的聚合端点，由服务端按 `created_at` 日期分桶，避免前端拉全量订单。

**请求**
```
GET /api/overview/orderTrend?days=14
```
- `days`：整数，默认 14，范围建议 [1, 90]。

**响应**
```json
{
  "days": 14,
  "buckets": [
    { "date": "2026-06-13", "count": 3 },
    { "date": "2026-06-14", "count": 0 }
  ]
}
```
- `buckets` 长度恒等于 `days`，按日期升序，覆盖 `[今天-days+1, 今天]`（含两端，服务器本地时区）。
- 无订单的日期 `count = 0`（前端无需补零）。
- 仅统计**未软删**订单（排除 `ORDER_DELETED` 状态）。
- `count` 为当日新建订单数（按 `orders.created_at` 归桶），不分 PURCHASE/OUTBOUND。

**角色**：与 `/overview/summary` 一致 —— auth 组，不强制特定角色。

**错误码**：400（`days` 非法）/ 401（未登录）/ 500。

---

### 3.2（可选优化）仓库货值分布 — `GET /overview/cargoByWarehouse`

**背景**：模块 4 当前可由前端拉全量 `items` 本地按 `warehouse_id` 聚合得到（对全角色开放，可行）。当物品量大时，服务端聚合更轻。**非必需**，后端 owner 视数据量决定是否实现；不实现时前端走全量 `items` 本地算。

**请求**
```
GET /api/overview/cargoByWarehouse
```

**响应**
```json
{
  "warehouses": [
    { "warehouse_id": 1, "name": "主仓库", "sum": 123456.78 },
    { "warehouse_id": 2, "name": "副仓库", "sum": 0 }
  ],
  "total": 123456.78
}
```
- `sum` = 该仓 `Σ price × item_inventory`，含冻结，null price 跳过（与 `CalSum` 同口径）。
- `total` = 各仓 `sum` 之和，应等于 `CalSum?id=0`。
- 无物品的仓库 `sum = 0`，仍列出（便于显示占比 0%）。
- 角色：任意登录角色。

---

