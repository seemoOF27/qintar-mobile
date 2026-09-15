import { readFileSync } from 'node:fs'
import { computeCard } from '@/vendor/cashback-engine'
import type { CategoryId, Spend } from '@/vendor/cashback-engine'
import type { ContractPayload } from '@/vendor/card-adapter'
import { formatEngineAmount } from '@/lib/money'
import { cardFacts, engineCards, isCompleteSelection, rankForSpend, selectionComparison, withFixedSelection } from '@/lib/cashback'

/**
 * طبقة الكاش باك فوق المحرك.
 *
 * **أهم اختبار هنا: التحويل لا يتباعد عن الآلية.** `withFixedSelection` يكرر
 * منطق آلية الاختيار الشهري ليقبل توزيع المستخدم، والتكرار خطر تباعد صامت.
 */

const payload = JSON.parse(readFileSync('src/vendor/card-payload.fixture.json', 'utf8')) as ContractPayload
const CARDS = engineCards(payload.cards)
const bsf = CARDS.find((card) => card.id === 'bsf-lifestyle')!

const PROFILES: Spend[] = [
  { fuel: 300, dining: 250, delivery: 150, grocery: 500, pharmacy: 100, travel: 0, education: 0, intl: 200, other: 300 },
  { fuel: 700, dining: 1200, delivery: 900, grocery: 2500, pharmacy: 300, travel: 800, education: 0, intl: 1000, other: 1500 },
  { fuel: 2000, dining: 4000, delivery: 2500, grocery: 6000, pharmacy: 800, travel: 3000, education: 1500, intl: 4000, other: 3500 },
  { fuel: 0, dining: 0, delivery: 3000, grocery: 0, pharmacy: 0, travel: 5000, education: 0, intl: 0, other: 0 },
]

describe('التوزيع الثابت يطابق الآلية', () => {
  /**
   * **حارس التباعد.** بالتوزيع الذي اختاره المحرك نفسه، الناتج يطابق حرفيًّا:
   * كل صف بنسبته وسقفه وكسبه.
   */
  it.each(PROFILES.map((spend, index) => [index, spend] as const))('ملف %i', (_index, spend) => {
    const engine = computeCard(bsf, spend)
    const fixed = computeCard(withFixedSelection(bsf, engine.allocation!), spend)

    expect(fixed.monthly).toBe(engine.monthly)
    expect(fixed.rows.map((row) => [row.cat.id, row.rate, row.cap, row.earned])).toEqual(
      engine.rows.map((row) => [row.cat.id, row.rate, row.cap, row.earned]),
    )
  })

  it('بطاقة بلا اختيار شهري تبقى كما هي', () => {
    const rajhi = CARDS.find((card) => card.id === 'rajhi-cashback-plus-platinum')!

    expect(withFixedSelection(rajhi, ['dining'])).toBe(rajhi)
  })
})

describe('الرقمان', () => {
  it('توزيع أسوأ يُظهر ما يُخسر، والأفضل لا يخسر شيئًا', () => {
    const spend = PROFILES[1]
    const bestOrder = computeCard(bsf, spend).allocation!
    const worstOrder = [...bestOrder].reverse()

    expect(selectionComparison(bsf, spend, bestOrder).lostMonthly).toBe(0)
    expect(selectionComparison(bsf, spend, worstOrder).lostMonthly).toBeGreaterThan(0)
  })

  /**
   * **الأرقام الثلاثة تتطابق كما يراها المستخدم.** حالة حقيقية من بيانات مردود:
   * ٥٧٫٠١٥ تُعرض ٥٧٫٠٢، والفرق الخام ١٢٦٫٠٣٥ كان يُعرض ١٢٦٫٠٤ لا ١٢٦٫٠٣.
   */
  it('الفرق يساوي طرح الرقمين المعروضين', () => {
    const spend: Spend = { fuel: 600, dining: 0, delivery: 0, grocery: 1800.5, pharmacy: 0, travel: 0, education: 0, intl: 0, other: 0 }
    const result = selectionComparison(bsf, spend, ['dining', 'grocery', 'travel', 'pharmacy', 'education'])

    expect(formatEngineAmount(result.chosen.monthly)).toBe(formatEngineAmount(57.02))
    expect(formatEngineAmount(result.best.monthly)).toBe(formatEngineAmount(183.05))
    expect(result.lostMonthly).toBe(126.03)
  })

  it('التوزيع الصالح: كل فئات الاختيار، كلٌّ مرة', () => {
    expect(isCompleteSelection(bsf, ['dining', 'grocery', 'travel', 'pharmacy', 'education'])).toBe(true)
    expect(isCompleteSelection(bsf, ['dining', 'grocery'])).toBe(false)
    expect(isCompleteSelection(bsf, ['dining', 'dining', 'travel', 'pharmacy', 'education'])).toBe(false)
    expect(isCompleteSelection(bsf, ['fuel', 'grocery', 'travel', 'pharmacy', 'education'] as CategoryId[])).toBe(false)
    expect(isCompleteSelection(bsf, null)).toBe(false)
  })
})

describe('الترتيب', () => {
  it('كل البطاقات السبع مرتّبة، والصافي تنازلي', () => {
    const ranked = rankForSpend(CARDS, PROFILES[1])

    expect(ranked).toHaveLength(7)

    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].netAnnual).toBeGreaterThanOrEqual(ranked[i].netAnnual)
    }
  })

  /** الرسوم الدولية تدخل حين يوجد صرف دولي، ولا تدخل حين لا يوجد. */
  it('الرسوم الدولية تُحتسب مع الصرف الدولي وحده', () => {
    const withIntl = rankForSpend(CARDS, { ...PROFILES[1], intl: 1000 })
    const without = rankForSpend(CARDS, { ...PROFILES[1], intl: 0 })

    const fxOf = (list: typeof withIntl) => list.find((card) => card.card.fx > 0)!

    expect(fxOf(withIntl).finalMonthly).toBeLessThan(fxOf(withIntl).monthly)
    expect(fxOf(without).finalMonthly).toBe(fxOf(without).monthly)
  })
})

describe('ما يُعرض ولا يُحسب', () => {
  it('المكافأة والحقول غير المنشورة بأسماء مفهومة', () => {
    const facts = cardFacts({
      ...payload.cards[0],
      signupBonus: { type: 'cashback', value: 300, label_ar: '٣٠٠ ريال', sourceUrl: 'https://example.com', verifiedAt: '2026-09-01' },
      unknown: { fxFeePercent: '', capReset: 'لم يُنشر' },
    })

    expect(facts.bonus?.label_ar).toBe('٣٠٠ ريال')
    expect(facts.unknown).toEqual(['رسوم العمليات الدولية', 'موعد تصفير السقوف'])
    expect(cardFacts(undefined)).toEqual({ bonus: null, unknown: [] })
  })
})
