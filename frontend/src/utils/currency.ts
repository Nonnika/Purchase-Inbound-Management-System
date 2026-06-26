/**
 * 货币格式化工具 —— 金额的阿拉伯数字与中文财务大写转换。
 *
 * 全部为纯函数，无副作用，可在任意页面/组件复用。口径与后端
 * `GET /items/CalSum` 一致（Σ price × item_inventory，含冻结库存）。
 */

const CN_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const CN_INT_UNITS = ['', '拾', '佰', '仟']
const CN_INT_SECTIONS = ['', '万', '亿', '兆']

/**
 * Compact cargo-value formatting for tight cells (KPI tiles, table columns):
 * ¥1,234.56 / ¥1.2万 / ¥1.2亿. Large totals collapse to 万/亿 so they stay
 * readable in a narrow column; small amounts keep full cents. Same口径 as
 * `formatCurrency` (Σ price × item_inventory, includes frozen) — just denser.
 */
export function formatCargoValue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1e8) return `¥${(value / 1e8).toFixed(2)}亿`
  if (value >= 1e4) return `¥${(value / 1e4).toFixed(1)}万`
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Format a monetary total with thousands separators, e.g. 12345.6 -> ¥12,345.60. */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Convert a non-negative currency amount to Chinese uppercase (财务大写),
 * e.g. 1234.56 -> "人民币壹仟贰佰叁拾肆元伍角陆分". Returns '—' for invalid
 * input and handles 0 (零元整) and integer amounts (…元整) per accounting
 * convention. This is the standard ¥-amount-to-words transform used on invoices.
 */
export function formatChineseCurrency(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value === 0) return '人民币零元整'

  // Split into integer and (up to 2) fractional digits — round to cents.
  const rounded = Math.round(value * 100)
  const intPart = Math.floor(rounded / 100)
  const fen = rounded % 100
  const jiao = Math.floor(fen / 10)
  const cent = fen % 10

  // Integer section -> Chinese, grouped in 4-digit sections (万/亿/兆).
  let intStr = ''
  if (intPart === 0) {
    intStr = ''
  } else {
    let n = intPart
    let sectionIdx = 0
    const sections: string[] = []
    while (n > 0) {
      const section = n % 10000
      n = Math.floor(n / 10000)
      let sectionStr = ''
      let zero = false
      for (let i = 0; i < 4; i++) {
        const d = Math.floor(section / Math.pow(10, 3 - i)) % 10
        if (d === 0) {
          zero = true
        } else {
          if (zero) {
            sectionStr += '零'
            zero = false
          }
          sectionStr += CN_DIGITS[d] + CN_INT_UNITS[3 - i]
        }
      }
      if (sectionStr === '') {
        // entire section is zero — keep a trailing zero flag for the next section
      } else {
        sectionStr += CN_INT_SECTIONS[sectionIdx]
      }
      sections.unshift(sectionStr)
      sectionIdx++
    }
    intStr = sections.join('')
    // Collapse a redundant leading 零 carried from an all-zero higher section.
    intStr = intStr.replace(/^零+/, '')
  }

  let result = '人民币'
  if (intStr) result += intStr + '元'
  else result += '零元' // fractional-only amount, e.g. 0.50 -> 人民币零元伍角

  if (jiao === 0 && cent === 0) {
    result += '整'
  } else {
    if (jiao === 0) {
      // When the 角 digit is 0 but there are 分, emit 零 before 分 (e.g. …元零伍分).
      result += '零'
    } else {
      result += CN_DIGITS[jiao] + '角'
    }
    if (cent !== 0) result += CN_DIGITS[cent] + '分'
  }
  return result
}
