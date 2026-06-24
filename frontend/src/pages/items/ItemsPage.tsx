import { useCallback, useEffect, useMemo, useState } from 'react'
import { itemsApi } from '@/api/items'
import { warehousesApi } from '@/api/warehouses'
import { itemCategoriesApi } from '@/api/itemCategories'
import { ApiError, toApiError } from '@/api/errors'
import { getCurrentUser } from '@/api/auth'
import type { Item, ItemInput, ItemUpdate } from '@/types/item'
import type { Warehouse } from '@/types/warehouse'
import type { ItemCategory } from '@/types/itemCategory'
import { ROLE_ID } from '@/types/role'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { Modal } from '@/components/ui/Modal/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import { ItemFormFields } from './ItemFormFields'
import styles from './ItemsPage.module.css'

type LoadState = 'loading' | 'error' | 'empty' | 'ready'

const emptyForm: ItemInput = {
  name: '',
  category_id: null,
  price: null,
  item_inventory: null,
  frozen_inventory: null,
  warehouse_id: null,
  warning_level: null,
}

/**
 * Items page — list + create + edit + delete over the item catalog
 * (backend/internal/controller/itemController.go). Reads need a valid JWT
 * (any authenticated role); `create` is purchaser/admin-gated; `update`/`delete`
 * are manager-gated (admin/warehouse/auditor) on the backend. Name search is
 * client-side (no selectByName endpoint exists).
 *
 * All failures surface as ApiError (HTTP code + short reason).
 */
export function ItemsPage() {
  const user = getCurrentUser()
  const roleId = user?.role_id ?? 0
  const canCreate = roleId === ROLE_ID.ADMIN || roleId === ROLE_ID.PURCHASER
  const canManage =
    roleId === ROLE_ID.ADMIN || roleId === ROLE_ID.WAREHOUSE || roleId === ROLE_ID.AUDITOR

  const [items, setItems] = useState<Item[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<ApiError | null>(null)

  // warehouses + categories for the create-form pickers and table name resolution
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const warehouseName = useMemo(() => {
    const m = new Map<number, string>()
    warehouses.forEach((w) => m.set(w.id, w.name))
    return m
  }, [warehouses])
  const categoryName = useMemo(() => {
    const m = new Map<number, string>()
    categories.forEach((c) => m.set(c.id, c.name))
    return m
  }, [categories])

  // client-side name search
  const [searchTerm, setSearchTerm] = useState('')

  // create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<ItemInput>(emptyForm)
  const [formError, setFormError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // edit modal
  const [editing, setEditing] = useState<Item | null>(null)
  const [editForm, setEditForm] = useState<ItemInput>(emptyForm)
  const [editError, setEditError] = useState<ApiError | null>(null)

  // transient action error (e.g. delete) shown inline above the table
  const [actionError, setActionError] = useState<ApiError | null>(null)

  // delete confirmation — native confirm replaced with a Carbon ConfirmDialog
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadAll = useCallback(async () => {
    setState('loading')
    setLoadError(null)
    try {
      const data = await itemsApi.selectAll()
      setItems(data)
      setState(data.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      setLoadError(toApiError(err))
      setState('error')
    }
  }, [])

  useEffect(() => {
    void loadAll()
    // Pickers + table name resolution — load once. Non-fatal on failure: the
    // selects just stay empty and the table falls back to raw ids.
    void warehousesApi.selectAll().then(setWarehouses).catch(() => undefined)
    void itemCategoriesApi.selectAll().then(setCategories).catch(() => undefined)
  }, [loadAll])

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(term) || String(it.id).includes(term),
    )
  }, [items, searchTerm])

  const openCreate = () => {
    setForm({ ...emptyForm })
    setFormError(null)
    setCreateOpen(true)
  }

  const updateField = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  /**
   * Parse an optional numeric input. Empty string → null (unset); otherwise
   * the parsed number. Non-numeric input falls through to NaN and is rejected
   * at submit time by the validators below.
   */
  const updateOptionalNumber = (key: keyof ItemInput, raw: string) => {
    if (raw.trim() === '') {
      updateField(key, null)
      return
    }
    const n = Number(raw)
    updateField(key, Number.isFinite(n) ? n : null)
  }

  const submitCreate = async () => {
    // Validate locally first — mirrors the backend's checks so the user gets
    // a friendly message instead of a 400 round-trip.
    if (!form.name.trim()) {
      setFormError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '物品名称不能为空' }),
      )
      return
    }
    const inventory = form.item_inventory
    const frozen = form.frozen_inventory
    if (inventory != null && inventory < 0) {
      setFormError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '库存不能为负数' }),
      )
      return
    }
    if (frozen != null && frozen < 0) {
      setFormError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '冻结库存不能为负数' }),
      )
      return
    }
    if (inventory != null && frozen != null && frozen > inventory) {
      setFormError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '冻结库存不能大于可用库存' }),
      )
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await itemsApi.create({
        ...form,
        name: form.name.trim(),
      })
      setCreateOpen(false)
      void loadAll()
    } catch (err) {
      setFormError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

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

  const handleDelete = (item: Item) => {
    setActionError(null)
    setPendingDelete(item)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await itemsApi.delete(pendingDelete.id)
      setPendingDelete(null)
      void loadAll()
    } catch (err) {
      setActionError(toApiError(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">物品管理</div>
            <h1 className={styles.title}>物品列表</h1>
          </div>
          <div className={styles.actions}>
            {canCreate && (
              <Button variant="primary" onClick={openCreate}>
                新增物品
              </Button>
            )}
            <Button variant="tertiary" onClick={() => void loadAll()} disabled={state === 'loading'}>
              {state === 'loading' ? '加载中…' : '刷新'}
            </Button>
          </div>
        </div>

        {/* Search bar — client-side name/id filter */}
        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="按名称或 ID 筛选"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {actionError && (
          <div className={styles.actionErrorWrap}>
            <ErrorBanner error={actionError} prefix="操作失败" />
          </div>
        )}

        {/* Body */}
        {state === 'error' ? (
          <ErrorBanner
            error={loadError ?? toApiError(new Error('加载失败'))}
            prefix="无法加载物品数据"
            action={
              <Button variant="tertiary" onClick={() => void loadAll()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' ? (
          <p className={styles.muted}>正在加载物品数据…</p>
        ) : filtered.length === 0 ? (
          <p className={styles.muted}>
            {items.length === 0
              ? canCreate
                ? '暂无物品数据，点击「新增物品」创建。'
                : '暂无物品数据。'
              : '没有符合筛选条件的物品。'}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>名称</th>
                  <th>单价</th>
                  <th>可用库存</th>
                  <th>分类</th>
                  <th>仓库</th>
                  <th>预警阈值</th>
                  <th>创建时间</th>
                  {canManage && <th>操作</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  // available = on-hand stock minus what an audit-approved
                  // outbound order has frozen (orderDao.freezeOutboundInventory).
                  // Using item_inventory directly here would overstate stock and
                  // suppress the low-inventory warning below.
                  const total = it.item_inventory ?? 0
                  const frozen = it.frozen_inventory ?? 0
                  const available = total - frozen
                  const low = it.warning_level != null && available <= it.warning_level
                  return (
                    <tr key={it.id}>
                      <td className={styles.mono}>{it.id}</td>
                      <td>{it.name}</td>
                      <td className={styles.mono}>{it.price != null ? `¥${it.price}` : '—'}</td>
                      <td>
                        <div className={styles.inv}>
                          <span className={[styles.mono, low ? styles.invLow : ''].filter(Boolean).join(' ')}>
                            {available}
                            {low ? ' · 库存不足' : ''}
                          </span>
                          {frozen > 0 && <span className={styles.invFrozen}>冻结 {frozen}</span>}
                        </div>
                      </td>
                      <td>
                        {it.category_id != null
                          ? categoryName.get(it.category_id) ?? `#${it.category_id}`
                          : '—'}
                      </td>
                      <td>
                        {it.warehouse_id != null
                          ? warehouseName.get(it.warehouse_id) ?? `#${it.warehouse_id}`
                          : '—'}
                      </td>
                      <td className={styles.mono}>
                        {it.warning_level != null ? (
                          <Tag kind={low ? 'red' : 'gray'}>{it.warning_level}</Tag>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={styles.mono}>{formatTime(it.created_at)}</td>
                      {canManage && (
                        <td>
                          <Button variant="ghost" onClick={() => openEdit(it)}>
                            编辑
                          </Button>
                          <Button variant="danger" onClick={() => handleDelete(it)}>
                            删除
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal — explicit-close only: clicking outside / Esc won't discard input */}
      <Modal
        open={createOpen}
        title="新增物品"
        onClose={() => setCreateOpen(false)}
        closeOnScrimClick={false}
        closeOnEscape={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void submitCreate()} disabled={submitting}>
              {submitting ? '提交中…' : '创建'}
            </Button>
          </>
        }
      >
        <ItemFormFields
          form={form}
          updateField={updateField}
          updateOptionalNumber={updateOptionalNumber}
          categories={categories}
          warehouses={warehouses}
          error={formError}
          errorPrefix="创建失败"
        />
      </Modal>

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

      {/* Delete confirmation — destructive, explicit action */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除物品"
        description={
          <>
            确认删除物品 <span className="confirmHighlight">「{pendingDelete?.name}」</span>
            （id={pendingDelete?.id}）？该操作不可撤销。
          </>
        }
        confirmLabel="删除"
        tone="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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

