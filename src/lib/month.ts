/**
 * الشهر التقويمي بصيغة `YYYY-MM` — ما يطلبه `/cashback/spend`.
 *
 * **بتوقيت الرياض لا الجهاز ولا UTC.** قرب منتصف الليل آخر الشهر يختلف الشهر
 * بين الثلاثة، والخادم يجمّع بتوقيت العرض.
 */
export function monthOf(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}`
}

/** شهر قبل أو بعد، بعبور السنة. */
export function shiftMonth(month: string, by: number): string {
  const [year, value] = month.split('-').map((piece) => Number.parseInt(piece, 10))
  const index = year * 12 + (value - 1) + by

  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}
