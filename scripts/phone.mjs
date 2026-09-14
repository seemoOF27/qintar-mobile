/**
 * يشغّل التطبيق لتجربته على **جوالك الحقيقي** عبر Expo Go — مجانًا، بلا حساب مطوّر.
 *
 * المشكلة التي يحلّها: `127.0.0.1` على الجوال يعني الجوال نفسه لا جهاز الماك،
 * فالتطبيق لا يصل للخادم ويقول «تعذّر الاتصال» بلا سبب ظاهر. فالسكربت يقرأ
 * عنوان الماك على الشبكة المحلية ويمرّره للتطبيق.
 *
 * الشرط: الجوال والماك على شبكة Wi-Fi واحدة، والخادم يستمع على كل الواجهات:
 *
 *     php artisan serve --host=0.0.0.0 --port=8000
 */
import { networkInterfaces } from 'node:os'
import { spawn } from 'node:child_process'

const port = process.env.API_PORT ?? '8000'

const lanAddress = Object.values(networkInterfaces())
  .flat()
  .find((entry) => entry?.family === 'IPv4' && !entry.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(entry.address))
  ?.address

if (lanAddress === undefined) {
  console.error('ما لقيت عنوان شبكة محلية. تأكد أن الماك متصل بـWi-Fi.')
  process.exit(1)
}

const apiUrl = `http://${lanAddress}:${port}`

console.log(`\nعنوان الخادم للجوال: ${apiUrl}`)
console.log('تأكد أن الخادم يعمل بـ: php artisan serve --host=0.0.0.0 --port=' + port)
console.log('ثم افتح Expo Go على الجوال وامسح الرمز.\n')

spawn('npx', ['expo', 'start', '--lan'], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
})
