import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { itemCategoriesApi } from '@/api/itemCategories'
import { ApiError, toApiError } from '@/api/errors'
import { getCurrentUser } from '@/api/auth'
import type { ItemCategory, ItemCategoryInput } from '@/types/itemCategory'
import { ROLE_ID } from '@/types/role'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { TextInput } from '@/components/ui/TextInput/TextInput'
import { Select } from '@/components/ui/Select/Select'
import type { SelectOption } from '@/components/ui/Select/Select'
import { Modal } from '@/components/ui/Modal/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './CategoriesPage.module.css'

type LoadState = 'loading' | 'error' | 'empty' | 'ready'

interface CategoryNode extends ItemCategory {
  children: CategoryNode[]
}

interface FlatRow {
  category: ItemCategory
  depth: number
}

const emptyForm: ItemCategoryInput = {
  name: '',
  description: '',
  parent: null,
}

/**
 * Item-categories page — full CRUD over the category tree
 * (backend/internal/controller/itemCategoriesController.go). Reads need a
 * valid JWT; writes (register/delete/Update*) are admin-gated on the backend.
 *
 * Categories form a tree via the nullable `parent` field (null/0 = root),
 * exactly like departments. The list renders as an indented tree; create/edit
 * happen in modals. All failures surface as ApiError (HTTP code + reason).
 */
export function CategoriesPage() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const roleId = user?.role_id ?? 0
  const canManage = roleId === ROLE_ID.ADMIN

  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [actionError, setActionError] = useState<ApiError | null>(null)

  // delete confirmation — triggered from the edit modal's footer
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<ItemCategoryInput>(emptyForm)
  const [createError, setCreateError] = useState<ApiError | null>(null)

  // edit modal
  const [editing, setEditing] = useState<ItemCategory | null>(null)
  const [editForm, setEditForm] = useState<ItemCategoryInput>(emptyForm)
  const [editError, setEditError] = useState<ApiError | null>(null)

  const [submitting, setSubmitting] = useState(false)

  const loadAll = useCallback(async () => {
    setState('loading')
    setLoadError(null)
    try {
      const data = await itemCategoriesApi.selectAll()
      setCategories(data)
      setState(data.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      setLoadError(toApiError(err))
      setState('error')
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const tree = useMemo(() => buildTree(categories), [categories])
  const rows = useMemo(() => flatten(tree), [tree])
  const nameById = useMemo(() => {
    const m = new Map<number, string>()
    categories.forEach((c) => m.set(c.id, c.name))
    return m
  }, [categories])

  const openCreate = () => {
    setCreateForm({ ...emptyForm })
    setCreateError(null)
    setActionError(null)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!createForm.name.trim()) {
      setCreateError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '分类名称不能为空' }),
      )
      return
    }
    setSubmitting(true)
    setCreateError(null)
    try {
      await itemCategoriesApi.register({
        name: createForm.name.trim(),
        description: normalizeText(createForm.description),
        parent: createForm.parent,
      })
      setCreateOpen(false)
      void loadAll()
    } catch (err) {
      setCreateError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (cat: ItemCategory) => {
    setEditing(cat)
    setEditForm({
      name: cat.name,
      description: cat.description ?? '',
      parent: cat.parent,
    })
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
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '分类名称不能为空' }),
      )
      return
    }
    setSubmitting(true)
    setEditError(null)
    try {
      const id = editing.id
      const nextName = editForm.name.trim()
      const nextDesc = normalizeText(editForm.description)
      const nextParent = editForm.parent

      if (nextName !== editing.name) {
        await itemCategoriesApi.updateNameById(id, nextName)
      }
      if (nextDesc !== (editing.description ?? '')) {
        await itemCategoriesApi.updateDescriptionById(id, nextDesc)
      }
      if (nextParent !== editing.parent) {
        await itemCategoriesApi.updateParentById(id, nextParent)
      }
      closeEdit()
      void loadAll()
    } catch (err) {
      setEditError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // Delete from within the edit modal — confirm, then remove + close + reload.
  const requestDelete = () => {
    setActionError(null)
    setConfirmDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!editing) return
    setDeleting(true)
    try {
      await itemCategoriesApi.deleteById(editing.id)
      setConfirmDeleteOpen(false)
      closeEdit()
      void loadAll()
    } catch (err) {
      setActionError(toApiError(err))
      setConfirmDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  // Parent-picker options. For create: every category. For edit: exclude self
  // and descendants to avoid a cycle. Rendered as a flat list (root option
  // first), depth conveyed by leading spaces.
  const parentSelectOptions = useMemo<SelectOption[]>(() => {
    const forbidden = editing ? descendantIds(tree, editing.id) : new Set<number>()
    return [
      { value: '', label: '（根分类 / 无上级）' },
      ...rows
        .filter((r) => !forbidden.has(r.category.id))
        .map((r) => ({ value: String(r.category.id), label: `${'  '.repeat(r.depth)}${r.category.name}` })),
    ]
  }, [rows, tree, editing])

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">物品分类管理</div>
            <h1 className={styles.title}>分类列表</h1>
          </div>
          <div className={styles.actions}>
            {canManage && (
              <Button variant="primary" onClick={openCreate}>
                新增分类
              </Button>
            )}
            <Button variant="tertiary" onClick={() => void loadAll()} disabled={state === 'loading'}>
              {state === 'loading' ? '加载中…' : '刷新'}
            </Button>
          </div>
        </div>

        {actionError && (
          <div className={styles.actionErrorWrap}>
            <ErrorBanner error={actionError} prefix="操作失败" />
          </div>
        )}

        {state === 'error' ? (
          <ErrorBanner
            error={loadError ?? toApiError(new Error('加载失败'))}
            prefix="无法加载分类数据"
            action={
              <Button variant="tertiary" onClick={() => void loadAll()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' ? (
          <p className={styles.muted}>正在加载分类数据…</p>
        ) : state === 'empty' ? (
          <p className={styles.muted}>
            {canManage ? '暂无分类数据，点击「新增分类」创建。' : '暂无分类数据。'}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>分类名称</th>
                  <th>说明</th>
                  <th>上级分类</th>
                  <th>创建时间</th>
                  <th className={styles.actionCol}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ category, depth }) => (
                  <tr key={category.id}>
                    <td className={styles.mono}>{category.id}</td>
                    <td>
                      <span className={styles.nameCell}>
                        {Array.from({ length: depth }).map((_, i) => (
                          <span key={i} className={styles.indent} aria-hidden="true" />
                        ))}
                        <Tag kind={depth === 0 ? 'blue' : 'gray'}>{category.name}</Tag>
                      </span>
                    </td>
                    <td className={styles.desc}>{category.description || '—'}</td>
                    <td className={styles.mono}>
                      {category.parent == null ? '—' : nameById.get(category.parent) ?? `#${category.parent}`}
                    </td>
                    <td className={styles.mono}>{formatTime(category.created_at)}</td>
                    <td className={styles.actionCol}>
                      <Button variant="ghost" onClick={() => navigate(`/categories/${category.id}`)}>
                        详情
                      </Button>
                      {canManage && (
                        <Button variant="ghost" onClick={() => openEdit(category)}>
                          编辑
                        </Button>
                      )}
                    </td>
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
        title="新增分类"
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
          label="分类名称 *"
          value={createForm.name}
          onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="分类名称"
        />
        <TextInput
          label="说明"
          value={createForm.description ?? ''}
          onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="可选"
        />
        <Select
          label="上级分类"
          value={createForm.parent == null ? '' : String(createForm.parent)}
          onChange={(e) =>
            setCreateForm((f) => ({ ...f, parent: e.target.value === '' ? null : Number(e.target.value) }))
          }
          options={parentSelectOptions}
        />
        {createError && <ErrorBanner error={createError} prefix="创建失败" />}
      </Modal>

      {/* Edit modal — explicit-close only */}
      <Modal
        open={editing !== null}
        title={`编辑分类 · ${editing?.name ?? ''}`}
        onClose={closeEdit}
        closeOnScrimClick={false}
        closeOnEscape={false}
        footer={
          <>
            <Button
              variant="danger"
              style={{ marginRight: 'auto' }}
              onClick={requestDelete}
              disabled={submitting || deleting}
            >
              删除
            </Button>
            <Button variant="ghost" onClick={closeEdit} disabled={submitting || deleting}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void submitEdit()} disabled={submitting || deleting}>
              {submitting ? '保存中…' : '保存'}
            </Button>
          </>
        }
      >
        <TextInput
          label="分类名称 *"
          value={editForm.name}
          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="分类名称"
        />
        <TextInput
          label="说明"
          value={editForm.description ?? ''}
          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="可选"
        />
        <Select
          label="上级分类"
          value={editForm.parent == null ? '' : String(editForm.parent)}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, parent: e.target.value === '' ? null : Number(e.target.value) }))
          }
          options={parentSelectOptions}
          helper="设为「（根分类）」即无上级；不可选择自身或其子分类。"
        />
        {editError && <ErrorBanner error={editError} prefix="保存失败" />}
      </Modal>

      {/* Delete confirmation — triggered from the edit modal */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="删除分类"
        description={
          <>
            确认删除分类 <span className="confirmHighlight">「{editing?.name}」</span>
            （id={editing?.id}）？该操作不可撤销。
            <span className="confirmNote">该操作不会自动删除其子分类。</span>
          </>
        }
        confirmLabel="删除"
        tone="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </section>
  )
}

/** Build a tree from a flat category list. Orphans (missing parent) become roots. */
function buildTree(cats: ItemCategory[]): CategoryNode[] {
  const byId = new Map<number, CategoryNode>()
  cats.forEach((c) => byId.set(c.id, { ...c, children: [] }))
  const roots: CategoryNode[] = []
  byId.forEach((node) => {
    if (node.parent != null && byId.has(node.parent)) {
      byId.get(node.parent)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.id - b.id)
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/** Depth-first flatten of the tree into table rows carrying their depth. */
function flatten(nodes: CategoryNode[], depth = 0, acc: FlatRow[] = []): FlatRow[] {
  for (const n of nodes) {
    acc.push({ category: n, depth })
    flatten(n.children, depth + 1, acc)
  }
  return acc
}

/** All ids in the subtree rooted at `id` (inclusive) — used to forbid cycles. */
function descendantIds(roots: CategoryNode[], id: number): Set<number> {
  const find = (nodes: CategoryNode[]): CategoryNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n
      const found = find(n.children)
      if (found) return found
    }
    return null
  }
  const result = new Set<number>()
  const collect = (node: CategoryNode | null) => {
    if (!node) return
    result.add(node.id)
    node.children.forEach(collect)
  }
  collect(find(roots))
  return result
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
