import { ATTACHMENT_LIMITS, attachmentProblem, uploadName } from '@/lib/attachments'

/** حدود المرفقات مطابقة للخادم، والاسم المرسل لا يحمل اسم الملف الأصلي. */
describe('مرفقات تواصل معنا', () => {
  it('صور وPDF فقط، و٥ ميجا بحد أقصى', () => {
    expect(attachmentProblem({ uri: 'x', type: 'image/png', size: 1000 })).toBeNull()
    expect(attachmentProblem({ uri: 'x', type: 'application/pdf', size: null })).toBeNull()
    expect(attachmentProblem({ uri: 'x', type: 'text/html', size: 10 })).toBe('صور أو PDF فقط.')
    expect(attachmentProblem({ uri: 'x', type: 'image/jpeg', size: ATTACHMENT_LIMITS.bytes + 1 })).toBe('الملف أكبر من ٥ ميجا.')
  })

  it('الاسم المرسل عام', () => {
    expect(uploadName({ uri: 'file:///كشف الراجحي.pdf', type: 'application/pdf', size: 1 }, 0)).toBe('attachment-1.pdf')
    expect(uploadName({ uri: 'x', type: 'image/jpeg', size: 1 }, 2)).toBe('attachment-3.jpg')
  })

  /** الحدود نفسها التي يفرضها الخادم — تباعدها يرفض ملفًا بعد رفعه. */
  it('تطابق حدود الخادم', () => {
    const fs = require('node:fs') as typeof import('node:fs')
    const model = fs.readFileSync('../api/app/Models/ContactAttachment.php', 'utf8')

    expect(model).toContain(`MAX_PER_THREAD = ${ATTACHMENT_LIMITS.perThread};`)
    expect(model).toContain(`MAX_KILOBYTES = ${ATTACHMENT_LIMITS.bytes / 1024};`)
  })
})
