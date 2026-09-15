import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { computeCard, optimizeMix, rankCards, isMixWorthIt, MIX_THRESHOLD } from '@/vendor/cashback-engine'
import type { Card, CategoryId, PerkOptions, Spend } from '@/vendor/cashback-engine'
import { toEngineCards, type ContractPayload } from '@/vendor/card-adapter'

/**
 * محرك الكاش باك المنسوخ — **لا يتفرّع عن مصدره، ويحسب ما يُفترض**.
 *
 * القرار `0003` عند منصة البطاقات: أي تغيير يغيّر ناتج حساب تغييرٌ كاسر. فهنا
 * حارسان: بصمة الملفات، والحالات الإلزامية الست بأرقام الشروط المنشورة.
 *
 * **والبطاقات من حمولة API مردود الحقيقية** عبر المحوّل — لا من مرجع يدوي.
 * فالاختبار يغطي المحوّل أيضًا: خطأٌ في ربط حقل يظهر هنا لا في شاشة المستخدم.
 */

const payload = JSON.parse(readFileSync('src/vendor/card-payload.fixture.json', 'utf8')) as unknown

const manifest = JSON.parse(readFileSync('src/vendor/ENGINE_SOURCE.json', 'utf8')) as {
  files: Record<string, string>
}

const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('المحرك المنسوخ لا يتفرّع', () => {
  it('كل ملف يطابق بصمته المسجَّلة', () => {
    for (const [file, hash] of Object.entries(manifest.files)) {
      expect({ file, hash: sha(`src/vendor/${file}`) }).toEqual({ file, hash })
    }
  })

  /**
   * **ولا عن نسخة الويب.** تطبيقان يحسبان للمستخدم نفسه: تباعد المحرك أو طبقة
   * التوزيع بينهما يعطيه رقمين مختلفين للصرف نفسه.
   */
  it('ويطابق نسخة الويب، ومعها طبقة التوزيع', () => {
    const web = '../web/src'

    if (!existsSync(web)) return

    for (const file of [...Object.keys(manifest.files).map((name) => `vendor/${name}`), 'lib/cashback.ts', 'vendor/ENGINE_SOURCE.json']) {
      expect({ file, hash: sha(`${web}/${file}`) }).toEqual({ file, hash: sha(`src/${file}`) })
    }
  })

  /** وحين يكون مستودع المنصة مجاورًا: لا تباعد عن المصدر. */
  it('ويطابق المصدر حين يكون متاحًا', () => {
    const source = '../../cards-platform/web/lib'

    if (!existsSync(source)) return

    for (const file of Object.keys(manifest.files)) {
      expect({ file, hash: sha(`${source}/${file}`) }).toEqual({ file, hash: sha(`src/vendor/${file}`) })
    }
  })
})

// ── الحالات الإلزامية — `cards-platform/docs/decisions/0003` ─────────────

const CARDS: Card[] = toEngineCards(payload as unknown as ContractPayload)
const NO_PERKS: PerkOptions = { on: false }

const card = (slug: string): Card => {
  const found = CARDS.find((item) => item.id === slug)
  if (!found) throw new Error(`بطاقة غير موجودة في الحمولة: ${slug}`)
  return found
}

const spend = (values: Spend): Spend => ({
  fuel: 0, dining: 0, delivery: 0, grocery: 0, pharmacy: 0,
  travel: 0, education: 0, intl: 0, other: 0,
  ...values,
})

const rowOf = (slug: string, values: Spend, category: CategoryId) =>
  computeCard(card(slug), spend(values)).rows.find((row) => row.cat.id === category)!

describe('الحالات الإلزامية الست', () => {
  it('الحمولة تحمل البطاقات السبع المنشورة', () => {
    expect(CARDS).toHaveLength(7)
  })

  /** السقف المشترك: الأهلي، ٣٠٠٠ مطاعم + ٣٠٠٠ توصيل ← ٢٠٠ لا ٤٠٠ */
  it('السقف المشترك: الأهلي', () => {
    const result = computeCard(card('snb-cashback-premium'), spend({ dining: 3000, delivery: 3000 }))

    const earned = result.rows
      .filter((row) => row.cat.id === 'dining' || row.cat.id === 'delivery')
      .reduce((sum, row) => sum + row.earned, 0)

    expect(earned).toBe(200)
  })

  /** السقف الإجمالي: الراجحي لا يتجاوز ٥٠٠ شهريًا مهما كان الصرف */
  it('السقف الإجمالي: الراجحي', () => {
    const huge = spend({ fuel: 50000, dining: 50000, delivery: 50000, grocery: 50000, pharmacy: 50000, travel: 50000, education: 50000, intl: 50000, other: 50000 })

    for (const slug of ['rajhi-cashback-plus-platinum', 'rajhi-cashback-plus-signature']) {
      expect(computeCard(card(slug), huge).monthly).toBeLessThanOrEqual(500)
    }
  })

  /** إعفاء الرسوم: الفرنسي، صرف سنوي ≥ ٢٠٬٠٠٠ ← رسوم صفر */
  it('إعفاء الرسوم: الفرنسي', () => {
    const above = computeCard(card('bsf-lifestyle'), spend({ other: 20000 / 12 }))
    const below = computeCard(card('bsf-lifestyle'), spend({ other: 19000 / 12 }))

    expect(above.feeWaived).toBe(true)
    expect(above.effectiveFee).toBe(0)
    expect(below.feeWaived).toBe(false)
  })

  /**
   * التوزيع: خليط بطاقتين لا يُقترح إن كان فرقه < ١٢٠ ريالًا سنويًا.
   *
   * يُختبر عند الحد بالضبط لا بصرف عشوائي: الفرق بين `>=` و`>` لا يظهر إلا
   * عند ١١٩٫٩٩ مقابل ١٢٠.
   */
  it('عتبة الخليط', () => {
    const profile = spend({ grocery: 1500, dining: 800 })
    const best = rankCards(CARDS, profile, false, NO_PERKS)[0]
    const mix = optimizeMix(CARDS, profile, false, NO_PERKS)!
    const twoCards = { ...mix, used: [mix.used[0], mix.used[0]] }

    expect(MIX_THRESHOLD).toBe(120)
    expect(isMixWorthIt({ ...twoCards, netAnnual: best.netAnnual + 119.99 }, best)).toBe(false)
    expect(isMixWorthIt({ ...twoCards, netAnnual: best.netAnnual + 120 }, best)).toBe(true)
    // وبطاقة واحدة لا تُسمّى خليطًا مهما كان الفرق.
    expect(isMixWorthIt({ ...mix, used: [mix.used[0]], netAnnual: best.netAnnual + 5000 }, best)).toBe(false)
  })

  /** الاستثناءات: موبايلي وعز، الوقود ← صفر */
  it('الاستثناءات: موبايلي وعز', () => {
    for (const slug of ['mobilypay-platinum', 'iz-cashback']) {
      expect(rowOf(slug, { fuel: 1000 }, 'fuel').earned).toBe(0)
    }
  })

  /** شرائح الصرف: الأول، ١٬٩٩٩ ← ٠٪ · ٢٬٠٠٠ ← ٣٪ · ١٥٬٠٠٠ ← ١٠٪ */
  it('شرائح الصرف: الأول', () => {
    expect(rowOf('sab-cashback-visa', { dining: 1999 }, 'dining').rate).toBe(0)
    expect(rowOf('sab-cashback-visa', { dining: 2000 }, 'dining').rate).toBe(0.03)
    expect(rowOf('sab-cashback-visa', { dining: 15000 }, 'dining').rate).toBe(0.1)
  })
})
