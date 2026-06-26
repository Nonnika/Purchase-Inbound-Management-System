# 概览仪表盘（HomePage）— API 需求文档

> 用途：描述「方向 A · 数据仪表盘强化」重构后，HomePage 各模块所需的数据与 API。
> 前端开发者（本仓库 Claude 实例）仅维护 `frontend/`，本文档同时标注**需后端新增**的端点，供后端 owner 评估实现。
> 现有 API 签名以 `frontend/src/api/*.ts` + `backend/internal/controller/*Controller.go` 为准。

## 1. 目标模块清单（自上而下）

| # | 模块 | 数据需求 | 现状 |
|---|------|---------|------|
| 1 | 页头 | 当前用户、刷新时间 | 已有（`auth.getCurrentUser()`） |
| 2 | KPI 三格 | 在库总货值、物品总数、待审核订单 | 部分已有 |
| 3 | 订单趋势（14 天） | 每日订单数时序 | **需后端新增** |
| 4 | 货值按仓库分布 | 各仓 Σ(price×item_inventory) + 占比 | 可前端算 / 建议后端聚合 |
| 5 | 库存预警排行 | `item_inventory ≤ warning_level` 的物品，按缺口降序 Top 5 | 可前端算 / 建议后端聚合 |
| 6 | 订单状态分布 | 各状态订单计数 | 已有（overview/summary） |
| 7 | 高货值物品 Top 5 | 按 `price×item_inventory` 降序 Top 5 | 可前端算 / 建议后端聚合 |
| 8 | 快捷入口 | role-gated 导航链接 | 已有（前端静态配置） |

## 2. 现有 API（已满足，无需改动）

| API | 方法 | 角色 | 供模块 |
|-----|------|------|--------|
| `/overview/summary` | GET | 任意登录角色 | KPI(物品总数/待审核)、状态分布 |
| `/items/CalSum?id=0` | GET | 任意登录角色 | KPI(在库总货值) |
| `/items/selectAll` | POST 分页 | 任意登录角色（仅需 JWT） | 货值按仓库分布、库存预警、高货值 Top（前端全量拉取后本地计算） |
| `/warehouses/selectAll` | POST 分页 | 任意登录角色（仅需 JWT） | 货值按仓库分布的仓名解析 |

> `fetchAll()` 自动翻页 `selectAll`，课程项目数据量下一次性拉全量物品/仓库后本地聚合，口径自洽。
> **货值口径**：`Σ price × item_inventory`，含冻结库存，与 `CalSum` 一致（null price 跳过）。

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

### 3.3（可选优化）库存预警 Top — `GET /overview/lowInventory?limit=5`

**背景**：模块 5 当前可由前端全量 `items` 本地算（`warning_level != null && item_inventory <= warning_level`，按 `warning_level − item_inventory` 降序）。**非必需**。

**请求**
```
GET /api/overview/lowInventory?limit=5
```

**响应**
```json
{
  "items": [
    { "id": 12, "name": "A4纸", "item_inventory": 5, "warning_level": 20, "gap": 15 }
  ]
}
```
- `gap = warning_level − item_inventory`（≥0）。
- 按 `gap` 降序，取前 `limit` 条；不足则返回全部。
- 角色：任意登录角色。

---

### 3.4（可选优化）高货值物品 Top — `GET /overview/topValueItems?limit=5`

**背景**：模块 7 当前可由前端全量 `items` 本地算（`price × item_inventory` 降序）。**非必需**。

**请求**
```
GET /api/overview/topValueItems?limit=5
```

**响应**
```json
{
  "items": [
    { "id": 7, "name": "服务器", "price": 9800.0, "item_inventory": 3, "value": 29400.0 }
  ]
}
```
- `value = price × item_inventory`；`price` 为 null 的物品跳过。
- 按 `value` 降序，取前 `limit`。
- 角色：任意登录角色。

## 4. 角色可达性矩阵

> 确认每个角色登录后仪表盘各模块是否可见/可加载。

| 模块 | admin(1) | purchaser(2) | warehouse(3) | auditor(4) | applicant(5) |
|------|----------|--------------|--------------|------------|--------------|
| KPI（货值/物品/待审核） | ✅ | ✅ | ✅ | ✅ | ✅ |
| 订单趋势 14 天 | ✅ | ✅* | ✅ | ✅ | ✅* |
| 货值按仓库分布 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 库存预警排行 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 订单状态分布 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 高货值物品 Top | ✅ | ✅ | ✅ | ✅ | ✅ |
| 快捷入口 | ✅ | ✅(去 /users) | ✅(去 /users) | ✅(去 /users) | ✅(去 /users) |

\* 仅在后端实现 **3.1 `orderTrend`** 后成立。若后端**不实现** 3.1：
- purchaser/applicant 无法拉 `orders/selectAll`，趋势模块对这两角色显示「无权限查看」占位（其余模块不受影响）。
- admin/auditor/warehouse 可走前端 `fetchAll(orders)` 本地分桶（降级方案）。

## 5. 前端降级策略（统一）

- `overview/summary` 失败 → 整页 ErrorBanner + 重试（致命）。
- `orderTrend` 失败 / 403 → 趋势模块占位「暂无趋势数据」。
- `items/selectAll` 失败 → 模块 4/5/7 各自占位「无法加载」。
- `CalSum(0)` 失败 → KPI 货值显示 `—`。
- `warehouses/selectAll` 失败 → 仓库分布以 `仓库#id` 兜底。
- 所有非致命失败不阻断其余模块渲染。

## 6. 实现优先级建议

1. **必需**：后端实现 3.1 `orderTrend`（否则两角色趋势缺失）。
2. **可选**：3.2 / 3.3 / 3.4 —— 数据量小可不做，前端全量 `items` 本地算即可。
3. 前端在 3.2–3.4 未实现前，统一走 `fetchAll(itemsApi.selectAll)` 本地聚合；后端实现后可平滑切换为聚合端点（接口预留 `overviewApi.*`）。
