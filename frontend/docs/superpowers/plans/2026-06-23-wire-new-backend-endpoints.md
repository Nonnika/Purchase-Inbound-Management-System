# 接入后端新增接口（物品编辑/删除、用户改部门、订单删除）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把后端 PR #17 新增的物品 update/delete、用户改部门、订单软删除接口接入前端，并修正因此过时的源码注释。

**Architecture:** 先建数据层（类型 + API 方法），再依次做三个独立 UI 改动。物品编辑复用一个新提取的 `ItemFormFields` 共享组件，提交时按字段 diff 只发变更字段；订单删除走独立 `handleDelete` + `window.confirm`，删除后订单留列表带"已删除"标签（软删除保哈希链审计）。

**Tech Stack:** Vite 6 + React 19 + TypeScript (strict) + react-router-dom 7 + axios + CSS Modules。无测试框架——验证关卡为 `npm run typecheck`（tsc strict）+ 手动验证。所有命令在 `frontend/` 下执行。

> **关于 TDD 的偏离说明**：本项目无任何测试框架（`package.json` 仅 dev/build/preview/typecheck，`DEVELOPMENT.md` 明确"类型检查是唯一静态校验关卡"）。引入测试运行器是不相关的大改动，违反项目约定。故每个任务以 `npm run typecheck` 通过 + 手动验证为关卡，保留 bite-sized 任务 + 频繁提交的节奏。

> **范围约束**：仅在 `frontend/` 内工作；`git add frontend/` 限定；禁止 `git push`。

---

## 文件结构

**新建：**
- `frontend/src/pages/items/ItemFormFields.tsx` — 物品表单字段共享组件，供创建/编辑 Modal 复用。

**修改：**
- `frontend/src/types/item.ts` — 新增 `ItemUpdate`；修正过时注释。
- `frontend/src/api/items.ts` — 新增 `update`/`delete`；修正头注释。
- `frontend/src/types/order.ts` — `ORDER_STEP` 加 `ORDER_DELETED`；`ORDER_NEXT_STEPS` 加终态。
- `frontend/src/api/orders.ts` — 新增 `delete`。
- `frontend/src/api/users.ts` — 新增 `updateDepartmentById`。
- `frontend/src/pages/items/ItemsPage.tsx` — 提取并复用 `ItemFormFields`；加编辑 Modal + diff 提交 + 删除按钮 + 操作列 + actionError。
- `frontend/src/pages/users/UsersPage.tsx` — 解锁编辑 Modal 部门字段；`submitEdit` 加部门分支。
- `frontend/src/pages/orders/OrdersPage.tsx` — `STATUS_META`/`STEP_LABELS` 加 `ORDER_DELETED`；详情动作区加删除按钮 + `handleDelete`。

---

## Task 1: 物品类型与 API（update/delete）

**Files:**
- Modify: `frontend/src/types/item.ts`
- Modify: `frontend/src/api/items.ts`

- [ ] **Step 1: 在 `types/item.ts` 新增 `ItemUpdate` 并修正过时注释**

打开 `frontend/src/types/item.ts`。把 `ItemInput` 上方的注释块中关于 categories/warehouses 路由不存在的过时段落删除（"Note: `category_id` and `warehouse_id` reference entities whose controllers the backend has not registered yet (no `/categories` or `/warehouses` routes), so the frontend can only collect raw ids for them."）。然后在文件末尾（`ItemInput` 接口之后）追加：

```ts
/**
 * Payload for `POST /api/items/update?id=`. Mirrors the backend
 * `updateItemRequest` — every field is an optional pointer, so only changed
 * fields are sent. Omitted fields are left untouched server-side.
 */
export type ItemUpdate = Partial<ItemInput>
```

- [ ] **Step 2: 在 `api/items.ts` 新增 `update`/`delete` 并修正头注释**

把文件头注释中的 "The backend exposes no update/delete for items, so the surface is read + create only." 删除，并在路由列表中补上 update/delete 两行。完整替换文件头注释块为：

```ts
/**
 * Item API — wraps the endpoints exposed by the Go/Gin backend
 * (see backend/internal/controller/itemController.go RegisterAuthRouter).
 * Reads need a valid JWT; `create` is purchaser/admin-gated;
 * `update`/`delete` are manager-gated (admin/warehouse/auditor).
 *
 *   GET    /api/items/selectAll        -> Item[]
 *   GET    /api/items/selectById?id=   -> Item   (400 id / 404)
 *   POST   /api/items/create  (purchaser/admin) -> { id }       (JSON: ItemInput)
 *   POST   /api/items/update?id=  (manager)     -> { affected } (JSON: ItemUpdate, partial)
 *   DELETE /api/items/delete?id= (manager)      -> { affected }
 *
 * All methods reject with an `ApiError` (see src/api/errors.ts) on failure.
 */
```

把 import 行（第 2-3 行）改为同时引入 `AffectedResult`：

```ts
import { apiClient } from './client'
import type { AffectedResult } from '@/types/user'
import type { CreatedResult } from '@/types/department'
import type { Item, ItemInput, ItemUpdate } from '@/types/item'
```

在 `itemsApi` 对象内、`create` 方法之后追加两个方法：

```ts
  /** POST /items/update?id= (manager) -> { affected }. Send only changed fields. */
  update(id: number, payload: ItemUpdate): Promise<AffectedResult> {
    return apiClient
      .post<AffectedResult>('/items/update', payload, { params: { id } })
      .then((res) => res.data)
  },

  /** DELETE /items/delete?id= (manager) -> { affected }. */
  delete(id: number): Promise<AffectedResult> {
    return apiClient
      .delete<AffectedResult>('/items/delete', { params: { id } })
      .then((res) => res.data)
  },
```

- [ ] **Step 3: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 无错误退出码 0。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/item.ts frontend/src/api/items.ts
git commit -m "feat(frontend): 接入物品 update/delete API 与 ItemUpdate 类型"
```

---

## Task 2: 订单类型与 API（ORDER_DELETED + delete）

**Files:**
- Modify: `frontend/src/types/order.ts`
- Modify: `frontend/src/api/orders.ts`

- [ ] **Step 1: 在 `types/order.ts` 的 `ORDER_STEP` 加 `ORDER_DELETED`**

在 `ORDER_STEP` 常量对象内（`WAREHOUSE_SHIPPED` 之后）追加一行：

```ts
  WAREHOUSE_SHIPPED: 'WAREHOUSE_SHIPPED',
  ORDER_DELETED: 'ORDER_DELETED',
```

- [ ] **Step 2: 在 `ORDER_NEXT_STEPS` 为两类各加 `ORDER_DELETED` 终态**

在 `ORDER_NEXT_STEPS` 对象中，`PURCHASE` 类的 `AUDIT_REJECTED` 分支后、`OUTBOUND` 类的 `AUDIT_REJECTED` 分支后各加一个 `ORDER_DELETED` 终态分支。完整替换 `ORDER_NEXT_STEPS` 为：

```ts
export const ORDER_NEXT_STEPS: Record<string, Record<string, string[]>> = {
  [ORDER_TYPE.PURCHASE]: {
    [ORDER_STEP.PURCHASE_REQUESTED]: [ORDER_STEP.AUDIT_APPROVED, ORDER_STEP.AUDIT_REJECTED],
    [ORDER_STEP.AUDIT_APPROVED]: [ORDER_STEP.WAREHOUSE_RECEIVED],
    [ORDER_STEP.ORDER_DELETED]: [],
  },
  [ORDER_TYPE.OUTBOUND]: {
    [ORDER_STEP.OUTBOUND_REQUESTED]: [ORDER_STEP.AUDIT_APPROVED, ORDER_STEP.AUDIT_REJECTED],
    [ORDER_STEP.AUDIT_APPROVED]: [ORDER_STEP.WAREHOUSE_SHIPPED],
    [ORDER_STEP.ORDER_DELETED]: [],
  },
}
```

> 说明：前端 map 只需让 `ORDER_DELETED` 是被识别的终态（无可达下一步）。哪些状态可"转入"删除由独立的权限判断决定（Task 7），不在此枚举。

- [ ] **Step 3: 在 `api/orders.ts` 新增 `delete` 方法**

`AffectedResult` 定义在 `@/types/user`（不在 `@/types/order`），需单独引入。把 import 块（第 1-8 行）替换为：

```ts
import { apiClient } from './client'
import type { AffectedResult } from '@/types/user'
import type {
  ChainVerifyResult,
  Order,
  OrderEvent,
  ORDER_STEP,
  ORDER_TYPE,
} from '@/types/order'
```

在 `ordersApi` 对象内、`warehouseShip` 方法之后追加 `delete` 方法：

```ts
  /** DELETE /orders/delete?id= -> { affected }. Soft delete (appends ORDER_DELETED event). */
  delete(orderId: number): Promise<AffectedResult> {
    return apiClient
      .delete<AffectedResult>('/orders/delete', { params: { id: orderId } })
      .then((res) => res.data)
  },
```

- [ ] **Step 4: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 退出码 0。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/order.ts frontend/src/api/orders.ts
git commit -m "feat(frontend): 订单类型加 ORDER_DELETED 终态并接入 delete API"
```

---

## Task 3: 用户 API（updateDepartmentById）

**Files:**
- Modify: `frontend/src/api/users.ts`

- [ ] **Step 1: 在 `usersApi` 新增 `updateDepartmentById`**

文件已 import `AffectedResult`（第 2 行 `import type { AffectedResult, User, UserInput } from '@/types/user'`），已存在 `postUserFormFields` 助手。在 `usersApi` 对象内、`updateRoleById` 方法之后追加：

```ts
  /**
   * POST /users/UpdateDepartmentById?id=  (form field: department_id) -> { affected }.
   * The backend reads `department_id` via ctx.PostForm, so it must be
   * form-encoded (like the other three ctx.PostForm user updates).
   */
  updateDepartmentById(id: number, departmentId: number): Promise<AffectedResult> {
    return postUserFormFields('/users/UpdateDepartmentById', id, {
      department_id: String(departmentId),
    })
  },
```

- [ ] **Step 2: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 退出码 0。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/users.ts
git commit -m "feat(frontend): 接入用户 UpdateDepartmentById API"
```

---

## Task 4: 提取 `ItemFormFields` 共享组件（重构创建 Modal）

**Files:**
- Create: `frontend/src/pages/items/ItemFormFields.tsx`
- Modify: `frontend/src/pages/items/ItemsPage.tsx`

此任务只做重构：把现有创建 Modal 的字段 JSX 提取成组件，创建 Modal 改为渲染它。不引入新功能，确保创建功能行为不变。

- [ ] **Step 1: 创建 `ItemFormFields.tsx`**

新建 `frontend/src/pages/items/ItemFormFields.tsx`：

```tsx
import type { ApiError } from '@/api/errors'
import type { ItemCategory } from '@/types/itemCategory'
import type { ItemInput } from '@/types/item'
import type { Warehouse } from '@/types/warehouse'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import { Select } from '@/components/ui/Select/Select'
import { TextInput } from '@/components/ui/TextInput/TextInput'
import styles from './ItemsPage.module.css'

interface ItemFormFieldsProps {
  form: ItemInput
  updateField: <K extends keyof ItemInput>(key: K, value: ItemInput[K]) => void
  updateOptionalNumber: (key: keyof ItemInput, raw: string) => void
  categories: ItemCategory[]
  warehouses: Warehouse[]
  error: ApiError | null
  /** Banner prefix, e.g. "创建失败" / "保存失败". */
  errorPrefix: string
}

/** Render an optional number as '' when null (so the input is clearable). */
function optionalNumberValue(value: number | null): string {
  return value == null ? '' : String(value)
}

/**
 * The item form body shared by the create and edit modals: name, price,
 * inventories, warning level, category + warehouse pickers, plus the inline
 * error banner. Lifted out of ItemsPage so the two modals stay in sync.
 */
export function ItemFormFields({
  form,
  updateField,
  updateOptionalNumber,
  categories,
  warehouses,
  error,
  errorPrefix,
}: ItemFormFieldsProps) {
  return (
    <>
      <TextInput
        label="物品名称 *"
        value={form.name}
        onChange={(e) => updateField('name', e.target.value)}
        placeholder="物品名称"
      />
      <div className={styles.row}>
        <TextInput
          label="单价"
          type="number"
          value={optionalNumberValue(form.price)}
          onChange={(e) => updateOptionalNumber('price', e.target.value)}
          placeholder="可选"
          helper="人民币金额"
        />
        <TextInput
          label="可用库存"
          type="number"
          value={optionalNumberValue(form.item_inventory)}
          onChange={(e) => updateOptionalNumber('item_inventory', e.target.value)}
          placeholder="可选"
          helper="不能为负数"
        />
      </div>
      <div className={styles.row}>
        <TextInput
          label="冻结库存"
          type="number"
          value={optionalNumberValue(form.frozen_inventory)}
          onChange={(e) => updateOptionalNumber('frozen_inventory', e.target.value)}
          placeholder="可选"
          helper="不能为负数，且 ≤ 可用库存"
        />
        <TextInput
          label="预警阈值"
          type="number"
          value={optionalNumberValue(form.warning_level)}
          onChange={(e) => updateOptionalNumber('warning_level', e.target.value)}
          placeholder="可选"
          helper="库存低于此值时标红"
        />
      </div>
      <div className={styles.row}>
        <Select
          label="分类"
          value={form.category_id == null ? '' : String(form.category_id)}
          onChange={(e) =>
            updateField('category_id', e.target.value === '' ? null : Number(e.target.value))
          }
          options={[
            { value: '', label: '（无分类）' },
            ...categories.map((c) => ({ value: String(c.id), label: `${c.name}（#${c.id}）` })),
          ]}
          helper={categories.length === 0 ? '暂无分类可选。' : undefined}
        />
        <Select
          label="仓库"
          value={form.warehouse_id == null ? '' : String(form.warehouse_id)}
          onChange={(e) =>
            updateField('warehouse_id', e.target.value === '' ? null : Number(e.target.value))
          }
          options={[
            { value: '', label: '（无仓库）' },
            ...warehouses.map((w) => ({ value: String(w.id), label: `${w.name}（#${w.id}）` })),
          ]}
          helper={warehouses.length === 0 ? '暂无仓库可选。' : undefined}
        />
      </div>
      {error && <ErrorBanner error={error} prefix={errorPrefix} />}
    </>
  )
}
```

- [ ] **Step 2: 在 `ItemsPage.tsx` 导入组件并删除本地 `optionalNumberValue`**

在 `ItemsPage.tsx` 顶部 import 区追加：

```ts
import { ItemFormFields } from './ItemFormFields'
```

删除文件底部 `ItemsPage` 之外的 `optionalNumberValue` 函数定义（约第 378-380 行）——它已移入 `ItemFormFields.tsx`。保留 `formatTime`。

> 注：`optionalNumberValue` 当前在创建 Modal 内有 4 处调用（`form.price`/`item_inventory`/`frozen_inventory`/`warning_level`，约第 313/321/331/339 行），这些调用都在 Step 3 即将替换的字段 JSX 里，替换后调用消失，故此处删除定义不会留下悬空引用。

- [ ] **Step 3: 创建 Modal 改为渲染 `ItemFormFields`**

把创建 Modal 内（约第 303-371 行）整段字段 JSX（`<TextInput label="物品名称 *"…` 起到 `{formError && <ErrorBanner … />}` 止）替换为：

```tsx
        <ItemFormFields
          form={form}
          updateField={updateField}
          updateOptionalNumber={updateOptionalNumber}
          categories={categories}
          warehouses={warehouses}
          error={formError}
          errorPrefix="创建失败"
        />
```

- [ ] **Step 4: 修正页面文档注释的过时段落**

把 `ItemsPage` 函数上方文档注释中 "The backend exposes no update/delete for items, so the surface is read + create only." 这句删除（update/delete 将在 Task 5 接入）。

- [ ] **Step 5: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 退出码 0。若报 `optionalNumberValue` 未定义，确认创建 Modal 已改用组件且本地函数已删。

- [ ] **Step 6: 手动验证创建功能不变**

Run: `cd frontend && npm run dev`（后端需在 :8080 运行）
打开 http://localhost:5173/items，用 purchaser/admin 登录，点"新增物品"填表提交，确认表单字段、占位、helper、错误横幅与重构前一致。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/items/ItemFormFields.tsx frontend/src/pages/items/ItemsPage.tsx
git commit -m "refactor(frontend): 提取 ItemFormFields 共享组件供创建/编辑复用"
```

---

## Task 5: 物品编辑 Modal + 按字段 diff 提交 + 删除

**Files:**
- Modify: `frontend/src/pages/items/ItemsPage.tsx`

- [ ] **Step 1: 加 `canManage` 角色门控与编辑/删除状态**

在 `ItemsPage` 组件内 `canCreate` 定义之后（约第 43 行）追加：

```ts
  const canManage =
    roleId === ROLE_ID.ADMIN ||
    roleId === ROLE_ID.WAREHOUSE ||
    roleId === ROLE_ID.AUDITOR
```

在 `createOpen`/`form`/`formError` 状态块之后追加编辑状态：

```ts
  // edit modal
  const [editing, setEditing] = useState<Item | null>(null)
  const [editForm, setEditForm] = useState<ItemInput>(emptyForm)
  const [editError, setEditError] = useState<ApiError | null>(null)

  // transient action error (e.g. delete) shown inline above the table
  const [actionError, setActionError] = useState<ApiError | null>(null)
```

确保 `Item`、`ItemInput`、`ApiError`、`toApiError` 已 import（`Item`/`ItemInput` 已在，`ApiError`/`toApiError` 已在）。

- [ ] **Step 2: 加 `diffItem` 助手（文件底部模块级）**

在 `formatTime` 函数之后追加模块级函数：

```ts
/**
 * Build a partial update payload of only the fields that changed between the
 * original item and the edited form. Both sides use `number | null` for the
 * nullable numerics, so a direct !== comparison detects changes (including
 * null ↔ number). Returns an empty object when nothing changed.
 */
function diffItem(original: Item, next: ItemInput): ItemUpdate {
  const patch: ItemUpdate = {}
  if (next.name !== original.name) patch.name = next.name
  if (next.category_id !== original.category_id) patch.category_id = next.category_id
  if (next.price !== original.price) patch.price = next.price
  if (next.item_inventory !== original.item_inventory) patch.item_inventory = next.item_inventory
  if (next.frozen_inventory !== original.frozen_inventory) patch.frozen_inventory = next.frozen_inventory
  if (next.warehouse_id !== original.warehouse_id) patch.warehouse_id = next.warehouse_id
  if (next.warning_level !== original.warning_level) patch.warning_level = next.warning_level
  return patch
}
```

在文件顶部 import 区追加 `ItemUpdate`：

```ts
import type { Item, ItemInput, ItemUpdate } from '@/types/item'
```

- [ ] **Step 3: 加 `openEdit`/`closeEdit`/`updateEditField` 与校验+提交逻辑**

在 `submitCreate` 之后追加：

```ts
  const openEdit = (item: Item) => {
    setEditing(item)
    setEditForm({
      name: item.name,
      category_id: item.category_id,
      price: item.price,
      item_inventory: item.item_inventory,
      frozen_inventory: item.frozen_inventory,
      warehouse_id: item.warehouse_id,
      warning_level: item.warning_level,
    })
    setEditError(null)
    setActionError(null)
  }

  const closeEdit = () => {
    setEditing(null)
    setEditError(null)
  }

  const updateEditField = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) => {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateEditOptionalNumber = (key: keyof ItemInput, raw: string) => {
    if (raw.trim() === '') {
      updateEditField(key, null)
      return
    }
    const n = Number(raw)
    updateEditField(key, Number.isFinite(n) ? n : null)
  }

  const submitEdit = async () => {
    if (!editing) return
    // Same local validation as create — mirrors backend checks.
    if (!editForm.name.trim()) {
      setEditError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '物品名称不能为空' }),
      )
      return
    }
    const inventory = editForm.item_inventory
    const frozen = editForm.frozen_inventory
    if (inventory != null && inventory < 0) {
      setEditError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '库存不能为负数' }),
      )
      return
    }
    if (frozen != null && frozen < 0) {
      setEditError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '冻结库存不能为负数' }),
      )
      return
    }
    if (inventory != null && frozen != null && frozen > inventory) {
      setEditError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '冻结库存不能大于可用库存' }),
      )
      return
    }

    const patch = diffItem(editing, { ...editForm, name: editForm.name.trim() })
    // Nothing changed — close silently.
    if (Object.keys(patch).length === 0) {
      closeEdit()
      return
    }

    setSubmitting(true)
    setEditError(null)
    try {
      await itemsApi.update(editing.id, patch)
      closeEdit()
      void loadAll()
    } catch (err) {
      setEditError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item: Item) => {
    if (!window.confirm(`确认删除物品「${item.name}」(id=${item.id})？`)) return
    setActionError(null)
    try {
      await itemsApi.delete(item.id)
      void loadAll()
    } catch (err) {
      setActionError(toApiError(err))
    }
  }
```

- [ ] **Step 4: 表格加操作列**

在表格 `<thead><tr>` 内最后一个 `<th>创建时间</th>` 之后追加：

```tsx
                      {canManage && <th>操作</th>}
```

在 `<tbody>` 每行最后一个 `<td>...{formatTime(it.created_at)}</td>` 之后追加（仍在该 `<tr>` 内）：

```tsx
                      {canManage && (
                        <td>
                          <Button variant="ghost" onClick={() => openEdit(it)}>
                            编辑
                          </Button>
                          <Button variant="danger" onClick={() => void handleDelete(it)}>
                            删除
                          </Button>
                        </td>
                      )}
```

- [ ] **Step 5: 表格上方加 actionError 横幅**

在搜索栏 `</div>`（`searchBar`）之后、`{state === 'error' ? (` 之前插入：

```tsx
        {actionError && (
          <div className={styles.actionErrorWrap}>
            <ErrorBanner error={actionError} prefix="操作失败" />
          </div>
        )}
```

确认 `styles.actionErrorWrap` 已存在（`UsersPage.module.css` 有，但这是 `ItemsPage.module.css`——若不存在需补样式）。

- [ ] **Step 6: 必要时补 `ItemsPage.module.css` 的 `actionErrorWrap`**

Run: `grep -n "actionErrorWrap" frontend/src/pages/items/ItemsPage.module.css`
若输出为空，在 `ItemsPage.module.css` 末尾追加：

```css
.actionErrorWrap {
  margin-bottom: 1rem;
}
```

- [ ] **Step 7: 加编辑 Modal（在创建 Modal 之后）**

在创建 `</Modal>` 之后追加：

```tsx
      {/* Edit modal — explicit-close only */}
      <Modal
        open={editing !== null}
        title={editing ? `编辑物品 · ${editing.name}` : '编辑物品'}
        onClose={closeEdit}
        closeOnScrimClick={false}
        closeOnEscape={false}
        footer={
          <>
            <Button variant="ghost" onClick={closeEdit} disabled={submitting}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void submitEdit()} disabled={submitting}>
              {submitting ? '保存中…' : '保存'}
            </Button>
          </>
        }
      >
        <ItemFormFields
          form={editForm}
          updateField={updateEditField}
          updateOptionalNumber={updateEditOptionalNumber}
          categories={categories}
          warehouses={warehouses}
          error={editError}
          errorPrefix="保存失败"
        />
      </Modal>
```

- [ ] **Step 8: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 退出码 0。常见错：`ItemUpdate` 未 import（Step 2）、`actionErrorWrap` 缺样式（Step 6）。

- [ ] **Step 9: 手动验证**

Run: `cd frontend && npm run dev`
- 用 admin/warehouse/auditor 登录 `/items`：操作列出现编辑/删除；用 purchaser 登录：无操作列（但有新增）。
- 编辑某物品改一个字段→保存→列表刷新反映改动；改多个字段→确认只发变更字段（Network 面板看 payload）。
- 不改任何字段→保存→Modal 直接关闭（无请求）。
- 名称清空→保存→"物品名称不能为空"横幅，无请求。
- 删除→确认→列表移除该行；删除失败（如后端 403）→actionError 横幅。

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/items/ItemsPage.tsx frontend/src/pages/items/ItemsPage.module.css
git commit -m "feat(frontend): 物品页加编辑 Modal（按字段 diff）与删除"
```

---

## Task 6: 用户改部门（解锁编辑 Modal 部门字段）

**Files:**
- Modify: `frontend/src/pages/users/UsersPage.tsx`

- [ ] **Step 1: 解锁编辑 Modal 的部门 `Select`**

把编辑 Modal 内（约第 520-534 行）的部门 `Select` 整块替换为可用版本：

```tsx
              <Select
                label="部门"
                value={editForm.department_id == null ? '' : String(editForm.department_id)}
                onChange={(e) =>
                  updateEditField(
                    'department_id',
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
                options={[
                  { value: '', label: '（无部门）' },
                  ...departments.map((d) => ({ value: String(d.id), label: `${d.name}（#${d.id}）` })),
                ]}
                helper={departments.length === 0 ? '暂无部门可选。' : undefined}
              />
```

- [ ] **Step 2: `submitEdit` 加部门变更分支**

在 `submitEdit` 的逐字段更新块中，找到 `if (nextRoleId !== editing.role_id) { await usersApi.updateRoleById(id, nextRoleId) }`，在其后追加：

```ts
      const nextDepartmentId = editForm.department_id
      // Backend department_id is a non-pointer int64 (0 = unassigned); normalize 0 -> null
      // to match the form's representation (openEdit already does `department_id || null`).
      if (nextDepartmentId !== (editing.department_id || null)) {
        await usersApi.updateDepartmentById(id, nextDepartmentId ?? 0)
      }
```

> 说明：`updateDepartmentById` 接受 `number`。表单中"无部门"为 `null`，后端用 `0` 表示未分配，故传 `nextDepartmentId ?? 0`。比较侧把 `editing.department_id`（可能为 0）归一为 `null` 与表单一致。

确认 `usersApi` 已 import（已在第 5 行）。

- [ ] **Step 3: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 退出码 0。

- [ ] **Step 4: 手动验证**

Run: `cd frontend && npm run dev`
- `/users` 编辑某用户：部门 `Select` 现在可选（不再 disabled），预选当前部门。
- 改部门→保存→列表反映新部门；不改部门→保存不触发 `UpdateDepartmentById`（Network 面板）。
- 把部门改为"（无部门）"→保存→后端 `department_id` 置 0（列表显示"—"）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/users/UsersPage.tsx
git commit -m "feat(frontend): 用户编辑解锁部门修改并接入 UpdateDepartmentById"
```

---

## Task 7: 订单删除（详情动作区删除按钮 + handleDelete）

**Files:**
- Modify: `frontend/src/pages/orders/OrdersPage.tsx`

- [ ] **Step 1: `STATUS_META` 与 `STEP_LABELS` 加 `ORDER_DELETED`**

在 `STATUS_META` 对象内（`WAREHOUSE_SHIPPED` 之后）追加：

```ts
  [ORDER_STEP.ORDER_DELETED]: { label: '已删除', kind: 'gray' },
```

在 `STEP_LABELS` 对象内（`WAREHOUSE_SHIPPED` 之后）追加：

```ts
  [ORDER_STEP.ORDER_DELETED]: '删除订单',
```

- [ ] **Step 2: 加 `canDeleteOrder` 派生值**

在 `availableActions` 的 `useMemo` 之后追加：

```ts
  const canDeleteOrder =
    selected != null &&
    selected.status !== ORDER_STEP.ORDER_DELETED &&
    (roleId === ROLE_ID.ADMIN || selected.user_id === (user?.id ?? 0))
```

确认 `user`、`roleId`、`ROLE_ID`、`ORDER_STEP` 已在作用域（均在）。

- [ ] **Step 3: 加 `handleDelete`**

在 `confirmAction` 之后追加：

```ts
  const handleDelete = async () => {
    if (!selected) return
    if (!window.confirm(`确认删除订单 #${selected.id}？该操作会向事件链追加删除记录（软删除）。`)) return
    setActionError(null)
    setSubmitting(true)
    try {
      await ordersApi.delete(selected.id)
      // Refresh the open order + chain + list (same refresh as confirmAction).
      const [refreshed, evs, ver] = await Promise.all([
        ordersApi.selectById(selected.id),
        ordersApi.events(selected.id),
        ordersApi.verifyChain(selected.id),
      ])
      setSelected(refreshed)
      setEvents(evs)
      setChain(ver)
      void loadOrders()
    } catch (err) {
      setActionError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }
```

确认 `setActionError`、`setSubmitting`、`ordersApi`、`toApiError`、`loadOrders` 均在作用域（均在）。

- [ ] **Step 4: 详情动作区加删除按钮**

找到详情 Modal 内的动作区（约第 543-558 行）：

```tsx
            {/* Role + status gated transition actions */}
            {availableActions.length > 0 ? (
              <div className={styles.detailActions}>
                {availableActions.map(({ step, action }) => (
                  <Button key={step} variant={action.kind} onClick={() => beginAction(step)}>
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className={styles.terminalNote}>
                {isTerminal(selected)
                  ? '该订单已结束，无后续操作。'
                  : '当前状态下你没有可执行的操作。'}
              </p>
            )}
```

替换为（保留 transition 动作与终态提示，下方追加独立删除按钮）：

```tsx
            {/* Role + status gated transition actions */}
            {availableActions.length > 0 ? (
              <div className={styles.detailActions}>
                {availableActions.map(({ step, action }) => (
                  <Button key={step} variant={action.kind} onClick={() => beginAction(step)}>
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className={styles.terminalNote}>
                {isTerminal(selected)
                  ? '该订单已结束，无后续操作。'
                  : '当前状态下你没有可执行的操作。'}
              </p>
            )}

            {/* Delete — separate from flow transitions; destructive. Admin or order owner. */}
            {canDeleteOrder && (
              <div className={styles.detailActions}>
                <Button variant="danger" onClick={() => void handleDelete()} disabled={submitting}>
                  删除订单
                </Button>
              </div>
            )}
```

- [ ] **Step 5: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 退出码 0。

- [ ] **Step 6: 手动验证**

Run: `cd frontend && npm run dev`
- 用 admin 登录 `/orders`，打开任一非已删订单详情：底部出现"删除订单"红按钮。
- 用 purchaser 打开**自己**的订单：可见删除按钮；打开**他人**订单（若能看到）：无删除按钮。
- 点删除→确认→订单 status 变"已删除"（灰标签），列表中仍可见，事件链多一条"删除订单"记录，链校验仍通过。
- 已删订单详情：无删除按钮，无 transition 动作，显示"该订单已结束"。
- 删除失败（如后端 403）→actionError 横幅。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/orders/OrdersPage.tsx
git commit -m "feat(frontend): 订单详情加删除按钮（软删除，留列表带已删除标签）"
```

---

## 收尾

- [ ] **全量 typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 退出码 0。

- [ ] **回归手动验证**

依次走 `/items`、`/users`、`/orders` 三页，覆盖各角色（admin/purchaser/warehouse/auditor/applicant）的按钮可见性与成功/失败路径，确认与后端门控一致。

- [ ] **更新文档（可选，若 spec 外发现新的过时注释）**

如实现中发现其他过时源码注释（如声称某接口不存在但已存在），一并修正，单独提交。

---

## Self-Review 结论

**Spec 覆盖**：
- §1 数据层 → Task 1（item）、Task 2（order）、Task 3（user）。
- §2 物品编辑/删除（含 `ItemFormFields` 提取、diff、操作列、actionError）→ Task 4 + Task 5。
- §3 用户改部门 → Task 6。
- §4 订单删除（STATUS_META、canDeleteOrder、handleDelete、删除按钮、不过滤）→ Task 7。
- 过时注释修正 → Task 1/2/4 内含。
无遗漏。

**占位符扫描**：无 TBD/TODO；每步含完整代码或确切命令。

**类型一致性**：`ItemUpdate`、`itemsApi.update/delete`、`ordersApi.delete`、`usersApi.updateDepartmentById`、`ORDER_DELETED` 在定义任务与使用任务间签名一致；`handleDelete`/`canDeleteOrder`/`diffItem`/`openEdit` 命名贯穿一致。
