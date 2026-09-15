import { monthOf, shiftMonth } from '@/lib/month'

describe('الشهر التقويمي', () => {
  it('يعبر السنة في الاتجاهين', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
    expect(shiftMonth('2026-09', 0)).toBe('2026-09')
  })

  /** ٣١ أغسطس ٢٢:٣٠ UTC هو أول سبتمبر في الرياض — والخادم يجمّع بتوقيت الرياض. */
  it('بتوقيت الرياض لا UTC', () => {
    expect(monthOf(new Date('2026-08-31T22:30:00Z'))).toBe('2026-09')
  })
})
