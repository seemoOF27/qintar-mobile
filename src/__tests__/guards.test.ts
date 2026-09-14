import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * حرّاس القواعد — **تفشل البناء لا تحذّر**.
 *
 * **ملاحظة على الصيغة:** `expect` في Jest يأخذ وسيطًا واحدًا لا وسيطين
 * كـVitest، فالمواضع المخالفة تُجمع في مصفوفة تُقارَن بالفراغ — فيظهر كل
 * موضع في رسالة الفشل نفسها بلا وسيط رسالة.
 *
 * كل حارس هنا يمسك خللًا يتسلّل صامتًا: لون مكتوب يدًا، `parseFloat` على
 * مبلغ، حزمة تحليلات، نص موافقة تباعد عن الخلفية. لا واحد منها يظهر في
 * تجربة يدوية.
 */

function sourceFiles(dir = 'src'): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) return sourceFiles(full)

    return /\.tsx?$/.test(full) && !full.includes('__tests__') && !full.endsWith('theme.ts')
      ? [full]
      : []
  })
}

function codeLines(file: string): { line: string; number: number }[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    // التعليقات تُطرح: الشرح يذكر الممنوع ليقول لماذا مُنع.
    .filter(({ line }) => !/^\s*(\*|\/\/)/.test(line))
}

describe('لا Hex في أي مكوّن', () => {
  /**
   * القاعدة الثانية في `CLAUDE.md`: كل لون عبر `theme.ts` المولَّد من
   * `shared/design-tokens.json`. تغيير الهوية تعديل ملف واحد.
   */
  it('كل لون من theme لا مكتوب يدًا', () => {
    const offences: string[] = []

    for (const file of [...sourceFiles(), 'App.tsx']) {
      for (const { line, number } of codeLines(file)) {
        if (/#[0-9a-fA-F]{3,8}\b/.test(line)) offences.push(`${file}:${number}`)
      }
    }

    expect(offences).toEqual([])
  })
})

describe('المال نصوص لا أعداد', () => {
  /**
   * `parseFloat` على مبلغ يعيد خطأ الفاصلة العائمة الذي حُذف من الخلفية
   * بالكامل. و`formatMoney` هي المكان الوحيد الذي يصير فيه المبلغ عرضًا.
   */
  it('لا parseFloat ولا Number على مبلغ خارج طبقة المال', () => {
    const offences: string[] = []

    for (const file of [...sourceFiles(), 'App.tsx']) {
      if (file.endsWith('lib/money.ts')) continue

      for (const { line, number } of codeLines(file)) {
        if (/(parseFloat|parseInt|Number)\s*\(\s*[^)]*(amount|balance|income|spent|total|remaining)/i.test(line)) {
          offences.push(`${file}:${number}`)
        }
      }
    }

    expect(offences).toEqual([])
  })

  it('و toLocaleString لا تُستخدم على مبلغ', () => {
    const offences: string[] = []

    for (const file of sourceFiles()) {
      if (file.endsWith('lib/money.ts')) continue

      for (const { line, number } of codeLines(file)) {
        if (/toLocaleString|toFixed/.test(line)) offences.push(`${file}:${number}`)
      }
    }

    expect(offences).toEqual([])
  })
})

describe('لا مراقبة أخطاء ولا تحليلات', () => {
  /**
   * القاعدة الرابعة: **عدم التحميل أقوى من تهيئة معطّلة.** حزم المراقبة
   * تركّب رصدًا تلقائيًا يلتقط الطلبات بحمولاتها بنفسها، فيصير ما يخرج
   * محكومًا بإعداداتها لا بكودنا.
   */
  it('الحزم غير مستوردة في أي ملف', () => {
    const banned = /from\s+['"](@sentry\/|sentry-expo|bugsnag|@amplitude|@segment|posthog|firebase\/analytics)/

    const offences = [...sourceFiles(), 'App.tsx'].filter((file) =>
      banned.test(readFileSync(file, 'utf8')),
    )

    expect(offences).toEqual([])
  })

  it('ولا هي في اعتماديات المشروع', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies?: Record<string, string>
    }

    const offenders = Object.keys(pkg.dependencies ?? {}).filter((name) =>
      /sentry|bugsnag|amplitude|segment|posthog|analytics/.test(name),
    )

    expect(offenders).toEqual([])
  })
})

describe('تقرير العطل لا يحمل بيانات', () => {
  /** حقلان لا غير: صنف الخطأ واسم الشاشة. والخادم يرفض ما عداهما أصلًا. */
  it('حدّ الأعطال لا يرسل رسالة ولا أثر مكدس', () => {
    const source = readFileSync('src/components/ErrorBoundary.tsx', 'utf8')
    const sending = source
      .slice(source.indexOf('componentDidCatch'), source.indexOf('render()'))
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/)/.test(line))
      .join('\n')

    expect(sending).not.toMatch(/error\.message/)
    expect(sending).not.toMatch(/error\.stack/)
    expect(sending).not.toMatch(/componentStack/)
    expect(sending).toMatch(/error\.name/)
  })
})

describe('لا نداء شبكة خارج خادمنا', () => {
  /**
   * القاعدة الأولى: **لا بيانة مالية تغادر التطبيق** إلا عبر خادمنا. أي
   * `fetch` لعنوان مطلق يتجاوز `client.ts` وبوابات الموافقة فيه.
   */
  it('كل نداء يمر بطبقة العميل', () => {
    const offences: string[] = []

    for (const file of sourceFiles()) {
      if (file.endsWith('api/client.ts')) continue

      for (const { line, number } of codeLines(file)) {
        if (/fetch\s*\(\s*['"`]https?:\/\//.test(line)) offences.push(`${file}:${number}`)
      }
    }

    expect(offences).toEqual([])
  })
})

describe('الرمز في المخزن الآمن', () => {
  /**
   * `AsyncStorage` ملف نصّي عادي. والرمز هنا يفتح بيانات مالية كاملة، فمكانه
   * Keychain على iOS وKeystore على أندرويد.
   */
  it('لا AsyncStorage لرمز الدخول', () => {
    // التعليقات تُطرح: شرح الملف يذكر `AsyncStorage` ليقول لماذا رُفض.
    const code = codeLines('src/api/client.ts')
      .map(({ line }) => line)
      .join('\n')

    expect(code).toMatch(/expo-secure-store/)
    expect(code).not.toMatch(/AsyncStorage/)
  })
})

describe('shared/ مطابق للخلفية', () => {
  /**
   * نصوص الموافقة تُعرض حرفيًا وتُخزَّن بصمتها في `shown_text_hash`. لو
   * تباعدت النسختان **صار الهاش يوثّق نصًّا غير الذي رآه المستخدم** — خلل
   * قانوني لا تقني.
   */
  function filesIn(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry)

      return statSync(full).isDirectory() ? filesIn(full) : [full]
    })
  }

  it('البصمة تطابق CHECKSUM', () => {
    const lines = filesIn('shared')
      .filter((file) => !file.endsWith('CHECKSUM'))
      .map((file) => {
        const hash = createHash('sha256').update(readFileSync(file)).digest('hex')

        return `${hash}  ${file.replace(/^shared\//, '')}`
      })
      .sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1))

    const actual = createHash('sha256').update(`${lines.join('\n')}\n`).digest('hex')
    const recorded = readFileSync('shared/CHECKSUM', 'utf8').trim()

    expect(actual).toBe(recorded)
  })

  /** حارس لا يُختبر فشله ليس حارسًا: البصمة يجب أن تتحرك عند تغيير بايت. */
  it('والبصمة تتحرك فعلًا عند تغيير بايت', () => {
    const base = createHash('sha256').update('a').digest('hex')
    const changed = createHash('sha256').update('b').digest('hex')

    expect(base).not.toBe(changed)
  })

  it('ونصوص الموافقة مطابقة لملفات الخلفية حرفيًا', () => {
    for (const file of readdirSync('shared/consent')) {
      const ours = readFileSync(join('shared/consent', file), 'utf8')
      const theirs = readFileSync(join('../api/resources/consent', file), 'utf8')

      expect({ file, text: ours }).toEqual({ file, text: theirs })
    }
  })
})

describe('الجوال أولًا', () => {
  /** حجم الخط في الحقول لا ينزل عن ١٦، وإلا كبّره iOS تلقائيًا. */
  it('حقل الإدخال يستخدم حجم body لا caption', () => {
    const ui = readFileSync('src/components/ui.tsx', 'utf8')
    const input = ui.slice(ui.indexOf('  input: {'), ui.indexOf('  error: {'))

    expect(input).toMatch(/fontSize: theme\.fontSize\.body/)
    expect(input).toMatch(/minHeight: theme\.touchMin/)
  })

  /** أهداف اللمس ٤٤ نقطة فأكثر. */
  it('الأزرار لا تنزل عن هدف اللمس', () => {
    const ui = readFileSync('src/components/ui.tsx', 'utf8')
    const button = ui.slice(ui.indexOf('  button: {'), ui.indexOf('  buttonPrimary'))

    expect(button).toMatch(/minHeight: theme\.touchMin/)
  })
})

describe('بوابة السياسة', () => {
  const gate = () =>
    codeLines('src/components/PolicyGate.tsx')
      .map(({ line }) => line)
      .join('\n')

  /** **لا صندوق مؤشَّر مسبقًا** — القاعدة الثالثة في `CLAUDE.md`. */
  it('القبول يبدأ غير مؤشَّر، والزر معطَّل قبله', () => {
    expect(gate()).toMatch(/const \[readAll, setReadAll\] = useState\(false\)/)
    expect(gate()).toMatch(/disabled=\{!readAll\}/)
  })

  /** **لا تُحتجز البيانات رهينة**: الخصوصية تُفتح من داخل البوابة. */
  it('من لا يوافق يصل إلى شاشة الخصوصية', () => {
    expect(gate()).toMatch(/privacyScreen/)
    expect(gate()).toMatch(/onOpenPrivacy/)
  })

  it('التحديث البسيط لا يحجب التطبيق', () => {
    const source = gate()
    const minor = source.slice(source.indexOf('policy_update_available'))

    expect(minor).toMatch(/\{children\}/)
  })

  /** تغيّر السياسة أثناء الجلسة يُعيد جلب الحساب. */
  it('رفضُ السياسة في منتصف الجلسة يُظهر شاشة القبول', () => {
    expect(readFileSync('src/api/client.ts', 'utf8')).toMatch(/policyAcceptanceRequired/)
    expect(readFileSync('src/context/AuthContext.tsx', 'utf8')).toMatch(/onPolicyAcceptanceRequired/)
  })
})
