/**
 * مرفقات «تواصل معنا» — حدود الخادم نفسها، ليُرفض الملف قبل رفعه لا بعده.
 *
 * **بلا اسم الملف الأصلي في الرفع:** «كشف الراجحي.pdf» بيانةٌ بذاتها، والخادم
 * لا يحفظه أصلًا. فالاسم المرسل عام.
 */
export const ATTACHMENT_LIMITS = {
  perThread: 3,
  bytes: 5 * 1024 * 1024,
  types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
}

export interface PickedFile {
  uri: string
  type: string
  size: number | null
}

export function attachmentProblem(file: PickedFile): string | null {
  if (!ATTACHMENT_LIMITS.types.includes(file.type)) return 'صور أو PDF فقط.'
  if (file.size !== null && file.size > ATTACHMENT_LIMITS.bytes) return 'الملف أكبر من ٥ ميجا.'

  return null
}

/** الاسم الذي يُرسل — عام، والامتداد من النوع. */
export function uploadName(file: PickedFile, index: number): string {
  const extension = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]

  return `attachment-${index + 1}.${extension}`
}
