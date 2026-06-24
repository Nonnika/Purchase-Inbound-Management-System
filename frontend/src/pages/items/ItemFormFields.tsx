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
