import { useCallback, useEffect, useMemo, useState } from 'react'
import { warehousesApi } from '@/api/warehouses'
import { ApiError, toApiError } from '@/api/errors'
import { getCurrentUser } from '@/api/auth'
import type { Warehouse, WarehouseInput } from '@/types/warehouse'
import { ROLE_ID } from '@/types/role'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { TextInput } from '@/components/ui/TextInput/TextInput'
import { Modal } from '@/components/ui/Modal/Modal'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './WarehousesPage.module.css'

type LoadState = 'loading' | 'error' | 'empty' | 'ready'

const emptyForm: WarehouseInput = {
  name: '',
  description: '',
}

/**
 * Warehouses page — full CRUD over the flat warehouse list
 * (backend/internal/controller/warehouseController.go). Reads need a valid
 * JWT; writes (register/delete/Update*) are admin-gated on the backend.
 * Warehouses have no hierarchy — just name + description.
 * All failures surface as ApiError (HTTP code + short reason).
 */
export function WarehousesPage() {
  const user = getCurrentUser()
  const roleId = user?.role_id ?? 0
  const canManage = roleId === ROLE_ID.ADMIN

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [actionError, setActionError] = useState<ApiError | null>(null)

  // client-side name search (no selectByName list variant; selectByName returns one)
  const [searchTerm, setSearchTerm] = useState('')

  // create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<WarehouseInput>(emptyForm)
  const [createError, setCreateError] = useState<ApiError | null>(null)

  // edit modal
  const [editing, setEditing] = useState<Warehouse | null>(null)
  const [editForm, setEditForm] = useState<WarehouseInput>(emptyForm)
  const [editError, setEditError] = useState<ApiError | null>(null)

  const [submitting, setSubmitting] = useState(false)

  const loadAll = useCallback(async () => {
    setState('loading')
    setLoadError(null)
    try {
      const data = await warehousesApi.selectAll()
      setWarehouses(data)
      setState(data.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      setLoadError(toApiError(err))
      setState('error')
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return warehouses
    return warehouses.filter(
      (w) => w.name.toLowerCase().includes(term) || String(w.id).includes(term),
    )
  }, [warehouses, searchTerm])

  const openCreate = () => {
    setCreateForm({ ...emptyForm })
    setCreateError(null)
    setActionError(null)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!createForm.name.trim()) {
      setCreateError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '仓库名称不能为空' }),
      )
      return
    }
    setSubmitting(true)
    setCreateError(null)
    try {
      await warehousesApi.register({
        name: createForm.name.trim(),
        description: normalizeText(createForm.description),
      })
      setCreateOpen(false)
      void loadAll()
    } catch (err) {
      setCreateError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (w: Warehouse) => {
    setEditing(w)
    setEditForm({ name: w.name, description: w.description ?? '' })
    setEditError(null)
    setActionError(null)
  }

  const closeEdit = () => {
    setEditing(null)
    setEditError(null)
  }

  const submitEdit = async () => {
    if (!editing) return
    if (!editForm.name.trim()) {
      setEditError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '仓库名称不能为空' }),
      )
      return
    }
    setSubmitting(true)
    setEditError(null)
    try {
      const id = editing.id
      const nextName = editForm.name.trim()
      const nextDesc = normalizeText(editForm.description)
      if (nextName !== editing.name) {
        await warehousesApi.updateNameById(id, nextName)
      }
      if (nextDesc !== (editing.description ?? '')) {
        await warehousesApi.updateDescriptionById(id, nextDesc)
      }
      closeEdit()
      void loadAll()
    } catch (err) {
      setEditError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (w: Warehouse) => {
    if (!window.confirm(`确认删除仓库「${w.name}」(id=${w.id})？`)) return
    setActionError(null)
    try {
      await warehousesApi.deleteById(w.id)
      if (editing?.id === w.id) closeEdit()
      void loadAll()
    } catch (err) {
      setActionError(toApiError(err))
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">仓库管理</div>
            <h1 className={styles.title}>仓库列表</h1>
          </div>
          <div className={styles.actions}>
            {canManage && (
              <Button variant="primary" onClick={openCreate}>
                新增仓库
              </Button>
            )}
            <Button variant="tertiary" onClick={() => void loadAll()} disabled={state === 'loading'}>
              {state === 'loading' ? '加载中…' : '刷新'}
            </Button>
          </div>
        </div>

        {/* Client-side name search */}
        <div className={styles.searchBarWrap}>
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

        {state === 'error' ? (
          <ErrorBanner
            error={loadError ?? toApiError(new Error('加载失败'))}
            prefix="无法加载仓库数据"
            action={
              <Button variant="tertiary" onClick={() => void loadAll()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' ? (
          <p className={styles.muted}>正在加载仓库数据…</p>
        ) : filtered.length === 0 ? (
          <p className={styles.muted}>
            {warehouses.length === 0
              ? canManage
                ? '暂无仓库数据，点击「新增仓库」创建。'
                : '暂无仓库数据。'
              : '没有符合筛选条件的仓库。'}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>仓库名称</th>
                  <th>说明</th>
                  <th>创建时间</th>
                  {canManage && <th className={styles.actionCol}>操作</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id}>
                    <td className={styles.mono}>{w.id}</td>
                    <td>
                      <Tag kind="blue">{w.name}</Tag>
                    </td>
                    <td className={styles.desc}>{w.description || '—'}</td>
                    <td className={styles.mono}>{formatTime(w.create_at)}</td>
                    {canManage && (
                      <td className={styles.actionCol}>
                        <Button variant="ghost" onClick={() => openEdit(w)}>
                          编辑
                        </Button>
                        <Button variant="danger" onClick={() => void handleDelete(w)}>
                          删除
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal — explicit-close only */}
      <Modal
        open={createOpen}
        title="新增仓库"
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
        <TextInput
          label="仓库名称 *"
          value={createForm.name}
          onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="仓库名称"
        />
        <TextInput
          label="说明"
          value={createForm.description ?? ''}
          onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="可选"
        />
        {createError && <ErrorBanner error={createError} prefix="创建失败" />}
      </Modal>

      {/* Edit modal — explicit-close only */}
      <Modal
        open={editing !== null}
        title={`编辑仓库 · ${editing?.name ?? ''}`}
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
        <TextInput
          label="仓库名称 *"
          value={editForm.name}
          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="仓库名称"
        />
        <TextInput
          label="说明"
          value={editForm.description ?? ''}
          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="可选"
        />
        {editError && <ErrorBanner error={editError} prefix="保存失败" />}
      </Modal>
    </section>
  )
}

/** Empty string → null (the backend stores absence as nil, not ""). */
function normalizeText(value: string | null): string | null {
  const v = (value ?? '').trim()
  return v === '' ? null : v
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
