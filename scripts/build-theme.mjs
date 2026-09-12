/**
 * يولّد `src/theme.ts` من `shared/design-tokens.json`.
 *
 * **مصدر الهوية واحد للويب والموبايل.** الويب يقرأ نفس الملف ويولّد
 * `tokens.css`، وهذا يولّد كائن TypeScript. تغيير الهوية تعديل ملف JSON
 * واحد لا بحث واستبدال في مئة مكوّن.
 *
 * يعمل قبل كل تشغيل واختبار، فلا يمكن أن يتباعد الملفان. ويحرس **عدم**
 * كتابة Hex مباشرة اختبارٌ في `src/__tests__`.
 *
 * والقيم تُحوَّل لأرقام: React Native لا يفهم `"16px"`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tokens = JSON.parse(readFileSync(resolve(here, '../shared/design-tokens.json'), 'utf8'))

/** `"16px"` → `16`. React Native يأخذ أعدادًا لا نصوصًا بوحدات. */
const px = (value) => Number(String(value).replace('px', ''))

const mapValues = (object, transform) =>
  Object.fromEntries(
    Object.entries(object)
      .filter(([key]) => !key.startsWith('$'))
      .map(([key, value]) => [key, transform(value)]),
  )

const flatten = (group) =>
  Object.fromEntries(
    Object.entries(group).flatMap(([groupName, entries]) =>
      Object.entries(entries).map(([name, value]) => [`${groupName}${name[0].toUpperCase()}${name.slice(1)}`, value]),
    ),
  )

const theme = {
  color: flatten(tokens.color),
  space: mapValues(tokens.space, px),
  radius: mapValues(tokens.radius, px),
  fontSize: mapValues(tokens.fontSize, px),
  touchMin: px(tokens.touchTarget.min),
}

const file = `/**
 * مولَّد من shared/design-tokens.json — **لا تعدّله يدويًا.**
 *
 * شغّل \`npm run theme\` بعد أي تغيير في ملف التوكنات.
 */

export const theme = ${JSON.stringify(theme, null, 2)} as const

export type ThemeColor = keyof typeof theme.color
`

mkdirSync(resolve(here, '../src'), { recursive: true })
writeFileSync(resolve(here, '../src/theme.ts'), file)

const count = Object.keys(theme.color).length + Object.keys(theme.space).length
console.log(`theme.ts ← ${count} توكنًا`)
