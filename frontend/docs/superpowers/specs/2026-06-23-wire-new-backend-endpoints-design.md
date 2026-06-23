# 设计文档：接入后端新增的物品编辑/删除、用户改部门、订单删除接口

**日期**: 2026-06-23
**范围**: 仅前端（`frontend/`），不修改 `backend/`
**背景**: 后端 PR #17（`d0d3282 完善库存订单权限校验`）新增了五个前端尚未接入的能力：
`POST /items/update`、`DELETE /items/delete`、`POST /users/UpdateDepartmentById`、
`DELETE /orders/delete`（软删除，追加 `ORDER_DELETED` 事件）。本设计把其中三项接入前端
（用户 block/unblock 暂不在本次范围内）。

---

## 1. 数据层（类型 + API 模块）

所有 UI 共用的基础，先于 UI 完成。

### `src/types/item.ts`
- 保留 `Item`、`ItemInput` 不变。
- 新增 `ItemUpdate = Partial<ItemInput>`，对应后端 `updateItemRequest`（全部可选指针字段）。
- 修正过时注释：`ItemInput` 注释中"backend has not registered yet (no `/categories` or `/warehouses` routes)"
  已不成立（这两个路由现在存在），删除该段。

### `src/api/items.ts`
- 新增 `update(id: number, payload: ItemUpdate): Promise<AffectedResult>` →
  `POST /items/update?id=`（JSON body，仅含变更字段）。
- 新增 `delete(id: number): Promise<AffectedResult>` → `DELETE /items/delete?id=`。
- `AffectedResult` 从 `@/types/user` 导入（已有定义），不再从 `@/types/department` 引 `CreatedResult`。
- 修正模块头注释"exposes no update/delete"为反映 update/delete 已存在。

### `src/types/order.ts`
- `ORDER_STEP` 新增 `ORDER_DELETED: 'ORDER_DELETED'`。
- `ORDER_NEXT_STEPS` 中为 `PURCHASE` 与 `OUTBOUND` 两类各加 `ORDER_DELETED` 作为
  **终态**（空数组，与 `AUDIT_REJECTED` 同形）。
  说明：前端 map 只需让 `ORDER_DELETED` 是一个被识别的、无可达下一步的状态；
  不在此枚举"哪些状态可转入删除"——删除按钮的可用性由独立的权限判断决定（见 §4），
  而非 `ORDER_NEXT_STEPS`。

### `src/api/orders.ts`
- 新增 `delete(orderId: number): Promise<AffectedResult>` → `DELETE /orders/delete?id=`，
  返回 `{ affected }`。

### `src/types/user.ts`
- 无变化。部门编辑复用现有 `User` 形状；后端表单字段编码在 API 模块内处理。

### `src/api/users.ts`
- 新增 `updateDepartmentById(id: number, departmentId: number): Promise<AffectedResult>`，
  复用现有 `postUserFormFields('/users/UpdateDepartmentById', id, { department_id: String(departmentId) })`
  助手（表单编码，与其余三个 `ctx.PostForm` 用户更新一致）。

---

## 2. 物品编辑/删除 UI（`ItemsPage`）

最大的 UI 改动。

### 角色门控（客户端，镜像后端 `manager = admin/warehouse/auditor`）
- 新增 `canManage = roleId ∈ {ADMIN, WAREHOUSE, AUDITOR}` —— 控制编辑+删除按钮显示。
- `canCreate = admin/purchaser` 保持不变。两者可重叠（admin 既能建也能管）。

### 表格
- 右侧新增"操作"列。每行渲染"编辑"（`ghost`）+"删除"（`danger`）按钮，仅当 `canManage` 时显示。
  复用 `UsersPage` 表格操作列的写法。
- 新增 `actionError` 内联 `ErrorBanner`（表格上方），承载删除失败等瞬态错误，参照 `UsersPage`。

### 共享表单组件 `ItemFormFields`
- 提取为 `src/pages/items/ItemFormFields.tsx`（或同目录），供创建与编辑 Modal 复用，
  避免重复约 70 行 JSX。
- Props：`form: ItemInput`、`updateField`、`updateOptionalNumber`、`categories`、
  `warehouses`、`error: ApiError | null`。
- 渲染现有创建 Modal 中的全部字段：名称、单价、可用库存、冻结库存、预警阈值、分类、仓库。
- 创建与编辑 Modal 都改为渲染 `<ItemFormFields ... />`。

### 编辑 Modal
- 新增状态：`editing: Item | null`、`editForm: ItemInput`、`editError: ApiError | null`；
  `submitting` 与创建共用（同一时刻只开一个 Modal）。
- `openEdit(item)`：用 item 当前值填充 `editForm`（`name` 直接取；可空数值/select 字段
  映射为 `number | null`，如 `frozen_inventory: item.frozen_inventory ?? null`，但保留 `null`）。
- Modal body = `<ItemFormFields form={editForm} ... error={editError} />`。
- `closeOnScrimClick={false}` + `closeOnEscape={false}`（含未保存输入，与创建一致）。

### 按字段 diff 提交
- 新增 `diffItem(original: Item, next: ItemInput): ItemUpdate`：逐字段比较，仅把变更字段放入
  返回对象。两侧均为 `number | null`，可直接 `!==` 比较（`null` 与数字视为变更）。
- 若 `diffItem` 返回空对象（无改动）：静默关闭 Modal，不调用 API。
- 提交前复用创建表单的本地校验：名称非空、`item_inventory ≥ 0`、`frozen_inventory ≥ 0`、
  `frozen_inventory ≤ item_inventory`（当两者皆设）。
- 调用 `itemsApi.update(editing.id, payload)`，成功后关闭 Modal + `loadAll()`。
  失败 → `toApiError` 存入 `editError`，由 `ItemFormFields` 的 `ErrorBanner` 展示。

### 删除
- `handleDelete(item)` → `window.confirm(...)`（与 `UsersPage` 一致）→ `itemsApi.delete(item.id)`
  → `loadAll()`。失败存入 `actionError`。

### 过时注释修正
- 页面文档注释"The backend exposes no update/delete for items"更新为反映 update/delete 已存在。

---

## 3. 用户改部门 UI（`UsersPage`）

最小改动，解锁编辑 Modal 中已存在的一个字段。

### 现状
编辑 Modal 的部门 `Select` 当前为 `disabled`，仅一个硬编码 option 显示当前部门名，
`helper="部门暂不支持修改（后端无对应接口）。"`（约 520-534 行）。

### 改动
- 替换为**可用**的部门 `Select`，与创建 Modal 的部门选择器一致：
  - `value={editForm.department_id == null ? '' : String(editForm.department_id)}`
  - `onChange` → `updateEditField('department_id', e.target.value === '' ? null : Number(e.target.value))`
  - `options` 同创建：`[{ value: '', label: '（无部门）' }, ...departments.map(...)]`
  - `helper` 改为 `departments.length === 0 ? '暂无部门可选。' : undefined`，删除"暂不支持修改"文案。

### `EditForm` 接口
已含 `department_id: number | null`（此前只读），无需类型改动。

### 提交逻辑（`submitEdit`）
当前逐字段 diff 跳过部门（注释"There is no UpdateDepartmentById"）。新增分支：
```ts
const nextDepartmentId = editForm.department_id
if (nextDepartmentId !== (editing.department_id || null)) {
  await usersApi.updateDepartmentById(id, nextDepartmentId)
}
```
放在现有 `updateUserNameById` / `updateRealNameById` 等分支旁。
注意：后端 `department_id` 是非指针 `int64`（0 = 未分配），故比较时把 `0` 归一为 `null`
以匹配表单表示，与 `openEdit` 已有的 `department_id: user.department_id || null` 一致。

### 创建 Modal
部门选择器已正确，保持不变。

---

## 4. 订单删除 UI（`OrdersPage` + 类型/API 见 §1）

### 状态元数据（`OrdersPage.tsx`）
- `STATUS_META[ORDER_DELETED] = { label: '已删除', kind: 'gray' }`
  （gray 而非 red——删除在此是主动操作，非如驳回的错误态）。
- `STEP_LABELS[ORDER_DELETED] = '删除订单'`（事件链时间线显示 `ORDER_DELETED` 事件时用）。
- 列表状态筛选 `Select` 由 `Object.entries(STATUS_META)` 构建，"已删除"自动成为可筛选项。

### `ORDER_NEXT_STEPS`（见 §1）
`ORDER_DELETED` 为终态（空数组）→ 删除后 `availableActions` 为空，详情显示
"该订单已结束，无后续操作。"。删除前仍需让删除按钮可达。

### 删除按钮位置
详情 Modal 的动作区（约 543-558 行）。渲染规则：
1. **transition 动作**（`availableActions`）：有则照常渲染（不变）。
2. **终态提示**（`isTerminal` / 当前用户无 transition 动作）：仅在 `availableActions.length === 0`
   时显示。注意——删除按钮的存在不影响这个判断：删除走独立权限（见下），不计入 `availableActions`，
   因此一个"无 transition 动作但可删除"的订单会同时显示终态提示 **和** 删除按钮。
3. **删除按钮**：当 `canDeleteOrder`（见下）为真时，渲染一个独立的"删除订单" `danger` 按钮，
   放在动作区底部、与 transition 动作/终态提示分开（删除是破坏性操作，不同于流转推进）。

### 删除权限（客户端，镜像后端）
```ts
const canDeleteOrder =
  selected != null &&
  selected.status !== ORDER_STEP.ORDER_DELETED &&
  (roleId === ROLE_ID.ADMIN || selected.user_id === (user?.id ?? 0))
```

### 删除流程
采用**独立 `handleDelete` + `window.confirm`**（与 `UsersPage`/物品删除一致），
而非复用 note 提示 Modal——因为删除是 `DELETE` 调用、不接受 note，
后端 `Delete` 处理器忽略 `event_payload`，复用 `confirmAction`（按 `STEP_ACTIONS[pendingStep]`
查表）会别扭。

`handleDelete`：
1. `window.confirm(...)`。
2. `ordersApi.delete(selected.id)`。
3. 刷新：重新 `selectById` + `events` + `verifyChain` 更新打开的详情，
   并 `loadOrders()` 刷新列表（复用 `confirmAction` 现有的刷新块，约 275-284 行）。
4. 失败 → 存入 `actionError` 横幅展示。

### 列表行为
**不过滤**已删订单——删除后订单留在列表，带"已删除"标签（用户 §A 决策），
保留哈希链审计可见性。

---

## 不在本次范围
- 用户 `blockById` / `unblockById` 接入（后端已有，前端暂不接）。
- 任何后端改动（硬删除订单等需后端 owner 处理）。
- 登录 403（被封禁用户）文案优化。

## 验证
- `npm run typecheck` 通过（strict 模式）。
- 手动：各角色登录后验证按钮可见性与后端门控一致；编辑/删除/改部门/删订单操作成功与失败路径。
