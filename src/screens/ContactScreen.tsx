import { useState } from 'react'
import { View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api/client'
import type { ContactThread } from '@/api/types'
import { Body, Button, Caption, Card, EmptyState, Field, Input, Notice, Row, Screen, Title } from '@/components/ui'
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
  const [sent, setSent] = useState(false)

  const threads = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<ContactThread[]>('/contact-requests')).data,
  })

  const open = useMutation({
    mutationFn: async () => (await api.post<ContactThread>('/contact-requests', { type, message })).data,
    onSuccess: () => {
      setMessage('')
      setSent(true)
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })

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
              setSent(false)
            }}
            multiline
            numberOfLines={4}
          />
        </Field>

        {sent && <Notice tone="positive">وصلتنا رسالتك.</Notice>}
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
