import {
  addMoney,
  formatMoney,
  isNegative,
  isZero,
  percentOf,
  subtractMoney,
} from '@/lib/money'

/**
 * **المال نصوص لا أعداد.**
 *
 * الخلفية تحسب بالهللة كعدد صحيح وتُرجع نصًّا عشريًا، وهذي الاختبارات تثبت
 * أن الموبايل لا يفسد ذلك بتحويل واحد.
 */
describe('المال', () => {
  it('جمع الهللات لا يفقد شيئًا', () => {
    expect(addMoney('0.10', '0.20')).toBe('0.30')
    expect(addMoney('1999.99', '0.01')).toBe('2000.00')
  })

  /** الحارس الحاسم: `0.1 + 0.2` بالأعداد العائمة ليست `0.3`. */
  it('جمع 0.01 ألف مرة يعطي 10.00 بالضبط', () => {
    let total = '0.00'

    for (let index = 0; index < 1000; index += 1) {
      total = addMoney(total, '0.01')
    }

    expect(total).toBe('10.00')
  })

  it('الطرح يظهر السالب كما هو ولا يُقصّ', () => {
    expect(subtractMoney('100.00', '150.50')).toBe('-50.50')
    expect(isNegative('-50.50')).toBe(true)
    expect(isZero('0.00')).toBe(true)
  })

  /** من كتب ثلاثة كسور يُقصّ لا يُقرَّب: التقريب هنا يخترع هللة. */
  it('الكسر الثالث يُقصّ ولا يُقرَّب', () => {
    expect(addMoney('0.999', '0.00')).toBe('0.99')
  })

  it('النسبة مقصوصة بين صفر ومئة، وقسمة على صفر لا تنفجر', () => {
    expect(percentOf('50.00', '200.00')).toBe(25)
    expect(percentOf('500.00', '200.00')).toBe(100)
    expect(percentOf('50.00', '0.00')).toBe(0)
  })

  it('العرض يفصل الآلاف ويبقي كسرين دائمًا', () => {
    expect(formatMoney('1234567.50')).toBe('1,234,567.50')
    expect(formatMoney('8.00')).toBe('8.00')
    expect(formatMoney('-8.50')).toBe('-8.50')
  })
})
