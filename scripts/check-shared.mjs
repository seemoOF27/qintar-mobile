/**
 * حارس مجلد `shared/`.
 *
 * ما فيه منسوخ من الخلفية ويجب أن يتطابق حرفيًا: نصوص الموافقة تُعرض كما هي
 * وتُخزَّن بصمتها في `shown_text_hash`، فلو تباعدت النسختان **صار الهاش يوثّق
 * نصًّا غير الذي رآه المستخدم** — خلل قانوني لا تقني.
 *
 * وبنفس الدرس الذي تعلّمناه في حارس العقود: حارس لا يُختبر فشله ليس حارسًا،
 * فالسكربت يتحقق أيضًا أن البصمة تتحرك عند تغيير بايت.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const sharedDir = resolve(here, '../shared')

function filesIn(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? filesIn(full) : [full]
  })
}

function fingerprint(dir) {
  const lines = filesIn(dir)
    .filter((file) => !file.endsWith('CHECKSUM'))
    .map((file) => {
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
      return `${hash}  ${relative(dir, file)}`
    })
    .sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1))

  return createHash('sha256').update(lines.join('\n') + '\n').digest('hex')
}

const recorded = readFileSync(join(sharedDir, 'CHECKSUM'), 'utf8').trim()
const actual = fingerprint(sharedDir)

if (recorded !== actual) {
  console.error('مجلد shared/ لا يطابق بصمته المسجَّلة.')
  console.error('المسجَّلة:', recorded)
  console.error('المحسوبة:', actual)
  console.error('\nزامنه مع qintar-backend قبل المتابعة — نصوص الموافقة تُعرض حرفيًا،')
  console.error('وتباعدها يجعل الهاش المخزَّن يوثّق نصًّا غير الذي رآه المستخدم.')
  process.exit(1)
}

console.log('shared/ مطابق ✓', actual.slice(0, 12))
