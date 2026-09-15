/**
 * المال نصوص لا أعداد.
 *
 * المبالغ تصل من الخادم كنصّ عشري (`"3825.00"`) وتبقى كذلك حتى العرض.
 * `parseFloat` عليها يعيد خطأ الفاصلة العائمة الذي حُذف من الخلفية بالكامل:
 * `0.1 + 0.2` ليست `0.3`، وجمع `0.01` ألف مرة لا يعطي `10.00`.
 *
 * فالحساب هنا بـ`BigInt` على الهللات، ولا تحويل إلى `number` إطلاقًا.
 */

export type Money = string

const SCALE = 100n

function toHalalas(amount: Money): bigint {
  const trimmed = amount.trim()
  const negative = trimmed.startsWith('-')
  const [whole, fraction = ''] = trimmed.replace('-', '').split('.')

  // كسران فقط، ومن كتب ثلاثة يُقصّ لا يُقرَّب: التقريب هنا يخترع هللة.
  const halalas = BigInt(whole || '0') * SCALE + BigInt((fraction + '00').slice(0, 2))

  return negative ? -halalas : halalas
}

function toDecimal(halalas: bigint): Money {
  const negative = halalas < 0n
  const value = negative ? -halalas : halalas

  return `${negative ? '-' : ''}${value / SCALE}.${(value % SCALE).toString().padStart(2, '0')}`
}

export function addMoney(a: Money, b: Money): Money {
  return toDecimal(toHalalas(a) + toHalalas(b))
}

export function subtractMoney(a: Money, b: Money): Money {
  return toDecimal(toHalalas(a) - toHalalas(b))
}

export function isZero(amount: Money): boolean {
  return toHalalas(amount) === 0n
}

export function isNegative(amount: Money): boolean {
  return toHalalas(amount) < 0n
}

/** نسبة مئوية صحيحة مقصوصة بين صفر ومئة، للأشرطة البصرية وحدها. */
export function percentOf(part: Money, whole: Money): number {
  const total = toHalalas(whole)

  if (total === 0n) return 0

  const percent = Number((toHalalas(part) * 100n) / total)

  return Math.min(100, Math.max(0, percent))
}

/**
 * **المكان الوحيد الذي يصير فيه المبلغ عرضًا.**
 *
 * لا `Number` ولا `parseFloat` على مبلغ في أي ملف آخر — يحرس ذلك اختبار.
 */
export function formatMoney(amount: Money): string {
  const halalas = toHalalas(amount)
  const negative = halalas < 0n
  const value = negative ? -halalas : halalas

  const whole = (value / SCALE).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  return `${negative ? '-' : ''}${whole}.${(value % SCALE).toString().padStart(2, '0')}`
}

/**
 * ناتج محرك الكاش باك — **الاستثناء الوحيد** من «المال نصوص».
 *
 * المحرك منسوخ من منصة البطاقات ولا يُعدَّل، ويحسب بأعداد. فناتجه يُقرَّب
 * إلى الهللة **مرة واحدة هنا** ثم يمر بطريق العرض نفسه، ولا يُجمع ناتجان منه
 * خارجه.
 */
export function formatEngineAmount(value: number): string {
  return formatMoney(toDecimal(BigInt(Math.round(value * 100))))
}
