import { useState } from 'react'
import { View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api/client'
import type { ContactThread } from '@/api/types'
import { Body, Button, Caption, Card, EmptyState, Field, Input, Notice, Row, Screen, Title } from '@/components/ui'
import { ATTACHMENT_LIMITS, attachmentProblem, uploadName, type PickedFile } from '@/lib/attachments'
import { theme } from '@/theme'

/**
 * تواصل معنا — مطابق للويب.
 *
 * **الرد هنا لا في البريد**: يصلك بريد «وصلك رد» بلا نصه.
 */
const TYPES = [
  { value: 'issue', label: 'مشكلة' },
  { value: 'inquiry', label: 'سؤال' },
  { value: 'suggestion', label: 'اقتراح' },
]

const key = ['contact-requests'] as const
const typeLabel = (type: string) => TYPES.find((item) => item.value === type)?.label ?? type

export function ContactScreen({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient()
  const [openId, setOpenId] = useState<number | null>(null)
  const [type, setType] = useState('issue')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<PickedFile[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ failed: number } | null>(null)

  const threads = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<ContactThread[]>('/contact-requests')).data,
  })

  /**
   * **الرسالة تُحفظ أولًا** ثم كل مرفق في طلب: تعذّر رفع صورة لا يضيّع ما كتبه
   * المستخدم، ويُقال له.
   */
  const open = useMutation({
    mutationFn: async () => {
      const thread = (await api.post<ContactThread>('/contact-requests', { type, message })).data
      let failed = 0

      for (const [index, file] of files.entries()) {
        try {
          await api.upload(`/contact-requests/${thread.id}/attachments`, 'file', file.uri, uploadName(file, index), file.type)
        } catch {
          failed++
        }
      }

      return failed
    },
    onSuccess: (failed) => {
      setMessage('')
      setFiles([])
      setSent({ failed })
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  })

  const add = (picked: PickedFile[]) => {
    const problem = picked.map(attachmentProblem).find((item) => item !== null) ?? null
    const valid = picked.filter((file) => attachmentProblem(file) === null)
    const overflow = files.length + valid.length > ATTACHMENT_LIMITS.perThread

    setFiles([...files, ...valid].slice(0, ATTACHMENT_LIMITS.perThread))
    setFileError(problem ?? (overflow ? `${ATTACHMENT_LIMITS.perThread} ملفات بحد أقصى.` : null))
  }

  /** من الصور — مضغوطة: لقطة الشاشة الكاملة تتجاوز الحد أحيانًا. */
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })

    if (result.canceled) return

    add(result.assets.map((asset) => ({ uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? null })))
  }

  /** PDF من الملفات — كشف حساب مثلًا. */
  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true })

    if (result.canceled) return

    add(result.assets.map((asset) => ({ uri: asset.uri, type: asset.mimeType ?? 'application/pdf', size: asset.size ?? null })))
  }

  const error = open.error instanceof ApiError ? open.error : null

  if (openId !== null) {
    return <ThreadView id={openId} onBack={() => setOpenId(null)} />
  }

  return (
    <Screen>
      <Button label="رجوع" variant="ghost" onPress={onBack} />
      <Title>تواصل معنا</Title>

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
          {TYPES.map((item) => (
            <Button
              key={item.value}
              label={item.label}
              variant={type === item.value ? 'primary' : 'ghost'}
              onPress={() => setType(item.value)}
            />
          ))}
        </View>

        <Field label="رسالتك" hint="بنرد عليك هنا، ويوصلك بريد تنبيه بلا نص الرد." error={error?.fieldError('message')}>
          <Input
            value={message}
            onChangeText={(value) => {
              setMessage(value)
              setSent(null)
            }}
            multiline
            numberOfLines={4}
          />
        </Field>

        <Field
          label="مرفقات (اختياري)"
          hint={`صور أو PDF، حتى ${ATTACHMENT_LIMITS.perThread} ملفات و٥ ميجا لكل ملف. يشوفها فريق الدعم فقط — غطِّ ما ما تبي يشوفه.`}
          error={fileError ?? undefined}
        >
          {files.length < ATTACHMENT_LIMITS.perThread && (
            <Row>
              <Button label="صورة" variant="ghost" onPress={() => void pickImage()} />
              <Button label="PDF" variant="ghost" onPress={() => void pickPdf()} />
            </Row>
          )}

          {files.map((file, index) => (
            <Row key={`${file.uri}-${index}`}>
              <Caption>{file.type === 'application/pdf' ? 'PDF' : 'صورة'} {index + 1}</Caption>
              <Button
                label="شيله"
                variant="ghost"
                onPress={() => {
                  setFiles(files.filter((_, position) => position !== index))
                  setFileError(null)
                }}
              />
            </Row>
          ))}
        </Field>

        {sent !== null && sent.failed === 0 && <Notice tone="positive">وصلتنا رسالتك.</Notice>}
        {sent !== null && sent.failed > 0 && (
          <Notice tone="warning">وصلتنا رسالتك، لكن {sent.failed} من المرفقات ما انرفعت.</Notice>
        )}
        {error !== null && !error.isValidation && <Notice tone="danger">{error.message}</Notice>}

        <Button label="أرسل" busy={open.isPending} disabled={message.trim().length < 10} onPress={() => open.mutate()} />
      </Card>

      <Title>رسائلك</Title>

      {(threads.data ?? []).length === 0 && <EmptyState title="ما أرسلت رسالة بعد." />}

      {(threads.data ?? []).map((thread) => (
        <Card key={thread.id}>
          <Row>
            <Body>{typeLabel(thread.type)}</Body>
            <Caption>
              {thread.status === 'open' ? 'مفتوحة' : 'محلولة'}
              {(thread.unread_replies ?? 0) > 0 ? ' · رد جديد' : ''}
            </Caption>
          </Row>
          <Caption>{thread.message}</Caption>
          <Button label="افتح" variant="ghost" onPress={() => setOpenId(thread.id)} />
        </Card>
      ))}
    </Screen>
  )
}

function ThreadView({ id, onBack }: { id: number; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')

  const thread = useQuery({
    queryKey: [...key, id],
    queryFn: async () => {
      const data = (await api.get<ContactThread>(`/contact-requests/${id}`)).data
      void queryClient.invalidateQueries({ queryKey: key, exact: true })

      return data
    },
  })

  const reply = useMutation({
    mutationFn: async () => api.post(`/contact-requests/${id}/replies`, { body }),
    onSuccess: () => {
      setBody('')
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })

  return (
    <Screen>
      <Button label="رجوع" variant="ghost" onPress={onBack} />

      {thread.data !== undefined && (
        <>
          <Card>
            <Caption>
              {typeLabel(thread.data.type)} · {thread.data.status === 'open' ? 'مفتوحة' : 'محلولة'}
            </Caption>
            <Body>{thread.data.message}</Body>
            {(thread.data.attachments ?? []).length > 0 && (
              <Caption>
                مرفق معها:{' '}
                {(thread.data.attachments ?? []).map((item, index) => `${item.kind === 'pdf' ? 'PDF' : 'صورة'} ${index + 1}`).join('، ')}
                . تنزيلها من صفحة الويب.
              </Caption>
            )}
          </Card>

          {(thread.data.replies ?? []).map((item) => (
            <Card key={item.id}>
              <Caption>{item.author === 'support' ? 'الدعم' : 'أنت'}</Caption>
              <Body>{item.body}</Body>
            </Card>
          ))}

          <Card>
            <Field label="أضف رد">
              <Input value={body} onChangeText={setBody} multiline numberOfLines={3} />
            </Field>
            <Button label="أرسل" busy={reply.isPending} disabled={body.trim().length < 2} onPress={() => reply.mutate()} />
          </Card>
        </>
      )}
    </Screen>
  )
}
