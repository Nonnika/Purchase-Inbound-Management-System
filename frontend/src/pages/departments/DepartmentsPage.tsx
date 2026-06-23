import { useCallback, useEffect, useMemo, useState } from 'react'
import { departmentsApi } from '@/api/departments'
import { ApiError, toApiError } from '@/api/errors'
import type { Department, DepartmentInput } from '@/types/department'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import { TextInput } from '@/components/ui/TextInput/TextInput'
import { Select } from '@/components/ui/Select/Select'
import type { SelectOption } from '@/components/ui/Select/Select'
import { Modal } from '@/components/ui/Modal/Modal'
import { ErrorBanner } from '@/components/ui/ErrorBanner/ErrorBanner'
import styles from './DepartmentsPage.module.css'

type LoadState = 'loading' | 'error' | 'empty' | 'ready'

interface DeptNode extends Department {
  children: DeptNode[]
}

interface FlatRow {
  dept: Department
  depth: number
}

const emptyForm: DepartmentInput = {
  name: '',
  description: '',
  parent: null,
}

/**
 * Departments page — full CRUD over the department tree
 * (backend/internal/controller/departmentController.go). Reads need a valid
 * JWT; writes (register/delete/Update*) are admin-gated on the backend.
 *
 * Departments form a tree via the nullable `parent` field (null/0 = root).
 * The list is rendered as an indented tree; create/edit happen in modals.
 * All failures surface as ApiError (HTTP code + short reason).
 */
export function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<ApiError | null>(null)

  // transient action error (e.g. delete failure) shown inline below the toolbar
  const [actionError, setActionError] = useState<ApiError | null>(null)

  // create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<DepartmentInput>(emptyForm)
  const [createError, setCreateError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // edit modal
  const [editing, setEditing] = useState<Department | null>(null)
  const [editForm, setEditForm] = useState<DepartmentInput>(emptyForm)
  const [editError, setEditError] = useState<ApiError | null>(null)

  const loadAll = useCallback(async () => {
    setState('loading')
    setLoadError(null)
    try {
      const data = await departmentsApi.selectAll()
      setDepartments(data)
      setState(data.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      setLoadError(toApiError(err))
      setState('error')
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // Tree built from the flat list. Roots = parent is null OR points to a
  // missing id (defensive: an orphaned parent reference is shown as a root).
  const tree = useMemo(() => buildTree(departments), [departments])
  const rows = useMemo(() => flatten(tree), [tree])
  const nameById = useMemo(() => {
    const m = new Map<number, string>()
    departments.forEach((d) => m.set(d.id, d.name))
    return m
  }, [departments])

  const openCreate = () => {
    setCreateForm({ ...emptyForm })
    setCreateError(null)
    setActionError(null)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!createForm.name.trim()) {
      setCreateError(
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '部门名称不能为空' }),
      )
      return
    }
    setSubmitting(true)
    setCreateError(null)
    try {
      await departmentsApi.register({
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

  const openEdit = (dept: Department) => {
    setEditing(dept)
    setEditForm({
      name: dept.name,
      description: dept.description ?? '',
      parent: dept.parent,
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
        new ApiError({ code: 'BAD_REQUEST', status: null, reason: '请求参数有误', detail: '部门名称不能为空' }),
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

      // Only hit the per-field update endpoints whose value actually changed.
      if (nextName !== editing.name) {
        await departmentsApi.updateNameById(id, nextName)
      }
      if (nextDesc !== (editing.description ?? '')) {
        await departmentsApi.updateDescriptionById(id, nextDesc)
      }
      if (nextParent !== editing.parent) {
        await departmentsApi.updateParentById(id, nextParent)
      }
      closeEdit()
      void loadAll()
    } catch (err) {
      setEditError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (dept: Department) => {
    if (!window.confirm(`确认删除部门「${dept.name}」(id=${dept.id})？\n该操作不会自动删除其子部门。`)) return
    setActionError(null)
    try {
      await departmentsApi.deleteById(dept.id)
      if (editing?.id === dept.id) closeEdit()
      void loadAll()
    } catch (err) {
      setActionError(toApiError(err))
    }
  }

  // Parent-picker options. For create: every department. For edit: exclude
  // self and descendants to avoid creating a cycle. Rendered as a flat list
  // (root option first), depth conveyed by leading spaces.
  const parentSelectOptions = useMemo<SelectOption[]>(() => {
    const forbidden = editing ? descendantIds(tree, editing.id) : new Set<number>()
    return [
      { value: '', label: '（根部门 / 无上级）' },
      ...rows
        .filter((r) => !forbidden.has(r.dept.id))
        .map((r) => ({ value: String(r.dept.id), label: `${'  '.repeat(r.depth)}${r.dept.name}` })),
    ]
  }, [rows, tree, editing])

  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">部门管理</div>
            <h1 className={styles.title}>部门列表</h1>
          </div>
          <div className={styles.actions}>
            <Button variant="primary" onClick={openCreate}>
              新增部门
            </Button>
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
            prefix="无法加载部门数据"
            action={
              <Button variant="tertiary" onClick={() => void loadAll()}>
                重试
              </Button>
            }
          />
        ) : state === 'loading' ? (
          <p className={styles.muted}>正在加载部门数据…</p>
        ) : state === 'empty' ? (
          <p className={styles.muted}>暂无部门数据，点击「新增部门」创建。</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>部门名称</th>
                  <th>说明</th>
                  <th>上级部门</th>
                  <th>创建时间</th>
                  <th className={styles.actionCol}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ dept, depth }) => (
                  <tr key={dept.id}>
                    <td className={styles.mono}>{dept.id}</td>
                    <td>
                      <span className={styles.nameCell}>
                        {Array.from({ length: depth }).map((_, i) => (
                          <span key={i} className={styles.indent} aria-hidden="true" />
                        ))}
                        <Tag kind={depth === 0 ? 'blue' : 'gray'}>{dept.name}</Tag>
                      </span>
                    </td>
                    <td className={styles.desc}>{dept.description || '—'}</td>
                    <td className={styles.mono}>
                      {dept.parent == null ? '—' : nameById.get(dept.parent) ?? `#${dept.parent}`}
                    </td>
                    <td className={styles.mono}>{formatTime(dept.created_at)}</td>
                    <td className={styles.actionCol}>
                      <Button variant="ghost" onClick={() => openEdit(dept)}>
                        编辑
                      </Button>
                      <Button variant="danger" onClick={() => void handleDelete(dept)}>
                        删除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal — explicit-close only: clicking outside / Esc won't discard input */}
      <Modal
        open={createOpen}
        title="新增部门"
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
          label="部门名称 *"
          value={createForm.name}
          onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="部门名称"
        />
        <TextInput
          label="说明"
          value={createForm.description ?? ''}
          onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="可选"
        />
        <Select
          label="上级部门"
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
        title={`编辑部门 · ${editing?.name ?? ''}`}
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
          label="部门名称 *"
          value={editForm.name}
          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="部门名称"
        />
        <TextInput
          label="说明"
          value={editForm.description ?? ''}
          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="可选"
        />
        <Select
          label="上级部门"
          value={editForm.parent == null ? '' : String(editForm.parent)}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, parent: e.target.value === '' ? null : Number(e.target.value) }))
          }
          options={parentSelectOptions}
          helper="设为「（根部门）」即无上级；不可选择自身或其子部门。"
        />
        {editError && <ErrorBanner error={editError} prefix="保存失败" />}
      </Modal>
    </section>
  )
}

/** Build a tree from a flat department list. Orphans (missing parent) become roots. */
function buildTree(depts: Department[]): DeptNode[] {
  const byId = new Map<number, DeptNode>()
  depts.forEach((d) => byId.set(d.id, { ...d, children: [] }))
  const roots: DeptNode[] = []
  byId.forEach((node) => {
    if (node.parent != null && byId.has(node.parent)) {
      byId.get(node.parent)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  // Stable ordering by id keeps the tree deterministic across reloads.
  const sortRec = (nodes: DeptNode[]) => {
    nodes.sort((a, b) => a.id - b.id)
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/** Depth-first flatten of the tree into table rows carrying their depth. */
function flatten(nodes: DeptNode[], depth = 0, acc: FlatRow[] = []): FlatRow[] {
  for (const n of nodes) {
    acc.push({ dept: n, depth })
    flatten(n.children, depth + 1, acc)
  }
  return acc
}

/** All ids in the subtree rooted at `id` (inclusive) — used to forbid cycles. */
function descendantIds(roots: DeptNode[], id: number): Set<number> {
  const find = (nodes: DeptNode[]): DeptNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n
      const found = find(n.children)
      if (found) return found
    }
    return null
  }
  const result = new Set<number>()
  const collect = (node: DeptNode | null) => {
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
  // YYYY-MM-DD HH:mm (local) — keep it terse for a table cell.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
