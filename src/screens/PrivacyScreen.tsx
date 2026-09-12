import { useState } from 'react'
import { View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api/client'
import type { ImpersonationRequest, PrivacyDashboard } from '@/api/types'
import { keys } from '@/api/hooks/keys'
import { useAuth } from '@/context/AuthContext'
import {
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Field,
  Input,
  Notice,
  Row,
  Screen,
  Title,
} from '@/components/ui'
import { theme } from '@/theme'

/**
 * الخصوصية.
 *
 * **سحب الموافقة بنقرة واحدة**: نفس عدد الخطوات التي مُنحت بها، بلا سبب
 * مطلوب وبلا شاشة إقناع — `compliance/consent-model.md`.
 *
 * **و«ما خرجت بياناتك ولا مرة» تُقال صراحةً** حين تكون صحيحة: الصمت في هذا
 * الموضع يُقرأ شكًّا.
 */
const PURPOSES = [
  { key: 'ai_parsing', label: 'تحليل الرسائل والفواتير' },
  { key: 'email_backup', label: 'النسخ الاحتياطي بالبريد' },
  { key: 'error_monitoring', label: 'مراقبة الأخطاء' },
  { key: 'card_integration', label: 'ربط البطاقات' },
]

export function PrivacyScreen() {
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const [reading, setReading] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const privacy = useQuery({
    queryKey: keys.privacy,
    queryFn: async () => (await api.get<PrivacyDashboard>('/privacy')).data,
  })

  const requests = useQuery({
    queryKey: ['impersonation-requests'],
    queryFn: async () => (await api.get<ImpersonationRequest[]>('/impersonation-requests')).data,
  })

  const consentText = useQuery({
    queryKey: keys.consentText(reading ?? ''),
    enabled: reading !== null,
    queryFn: async () =>
      (
        await api.get<{ text: string; fallback: string; version: string }>(
          `/privacy/consents/${reading}/text`,
        )
      ).data,
  })

  const setConsent = useMutation({
    mutationFn: async ({ type, granted }: { type: string; granted: boolean }) =>
      granted ? api.post(`/privacy/consents/${type}`) : api.delete(`/privacy/consents/${type}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.privacy }),
  })

  const answer = useMutation({
    mutationFn: async ({ id, approve }: { id: number; approve: boolean }) =>
      api.post(`/impersonation-requests/${id}/${approve ? 'approve' : 'reject'}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['impersonation-requests'] })
      void queryClient.invalidateQueries({ queryKey: keys.privacy })
    },
  })

  const pending = (requests.data ?? []).filter((request) => request.status === 'pending')
  const egress = privacy.data?.data_egress

  return (
    <Screen>
      <Title>الخصوصية</Title>

      {notice !== null && <Notice tone="positive">{notice}</Notice>}

      {/* طلب دعم معلّق أولًا: عليه مهلة، وتأخيره رفضٌ بحكم الوقت. */}
      {pending.map((request) => (
        <Card key={request.id}>
          <Body>{request.requested_by ?? 'الدعم الفني'} يطلب الدخول لحسابك</Body>
          <Caption>{request.reason}</Caption>
          <Caption>بلا ردّك ما يقدر يدخل إطلاقًا.</Caption>

          <Row>
            <Button label="وافق" onPress={() => answer.mutate({ id: request.id, approve: true })} />
            <Button
              label="ارفض"
              variant="ghost"
              onPress={() => answer.mutate({ id: request.id, approve: false })}
            />
          </Row>
        </Card>
      ))}

      <Card>
        <Body>أين ذهبت بياناتك</Body>

        {egress?.ever === false ? (
          <Caption>ما خرجت بياناتك من هذا التطبيق ولا مرة.</Caption>
        ) : (
          <>
            <Caption>
              آخر مرة: {egress?.last?.destination} — {egress?.last?.occurred_at?.slice(0, 10)}
            </Caption>
            {Object.entries(egress?.per_purpose ?? {}).map(([purpose, event]) => (
              <Caption key={purpose}>
                {purpose}: {event.destination} — {event.occurred_at.slice(0, 10)}
              </Caption>
            ))}
          </>
        )}
      </Card>

      <Title>ما وافقت عليه</Title>

      {PURPOSES.map((purpose) => {
        const state = privacy.data?.consents[purpose.key]
        const granted = state?.granted === true

        return (
          <Card key={purpose.key}>
            <Row>
              <View style={{ flex: 1 }}>
                <Body>{purpose.label}</Body>
                {granted && <Caption>مفعّل من {state?.granted_at?.slice(0, 10)}</Caption>}
              </View>

              {/*
                **نقرة واحدة في الاتجاهين.** لا تأكيد إضافي على الإيقاف ولا
                سبب مطلوب: الإيقاف أسهل من التشغيل أو مثله، لا أصعب.
              */}
              <Button
                label={granted ? 'أوقفه' : 'فعّله'}
                variant={granted ? 'ghost' : 'primary'}
                onPress={() =>
                  granted
                    ? setConsent.mutate(
                        { type: purpose.key, granted: false },
                        { onSuccess: () => setNotice('تم الإيقاف.') },
                      )
                    : setReading(purpose.key)
                }
              />
            </Row>

            {/* **الإفصاح قبل التفعيل**، وبالنص المعروض نفسه من الخادم. */}
            {reading === purpose.key && consentText.data !== undefined && (
              <View style={{ gap: theme.space['2'] }}>
                <Divider />
                <Caption>{consentText.data.text}</Caption>
                <Caption>لو ما فعّلته: {consentText.data.fallback}</Caption>

                <Row>
                  <Button
                    label="قرأته وأوافق"
                    onPress={() => {
                      setConsent.mutate({ type: purpose.key, granted: true })
                      setReading(null)
                    }}
                  />
                  <Button label="لا" variant="ghost" onPress={() => setReading(null)} />
                </Row>
              </View>
            )}
          </Card>
        )
      })}

      <ExportCard onDone={setNotice} />

      <Card>
        <Body>آخر ما صار في حسابك</Body>

        {(privacy.data?.activity ?? []).slice(0, 10).map((entry, index) => (
          <Caption key={index}>
            {entry.entity} — {entry.action}
            {entry.is_impersonated ? ' (جلسة دعم فني)' : ''} — {entry.at.slice(0, 10)}
          </Caption>
        ))}
      </Card>

      <Button label="خروج" variant="ghost" onPress={() => void signOut()} />

      <Caption>
        حذف الحساب من صفحة الويب: يحتاج تأكيدًا بكتابة بريدك، والمهلة سبعة أيام تقدر تلغيها فيها.
      </Caption>
    </Screen>
  )
}

/**
 * التصدير.
 *
 * **كلمة المرور لحظية ولا تُحفظ** — قرار §١٥ في 0005. والملف لا يُنزَّل على
 * الجوال: يُطلب من صفحة الويب حيث للمستخدم مكان يحفظه فيه ويفتحه بأداة تفكّ
 * تشفير AES.
 */
function ExportCard({ onDone }: { onDone: (message: string) => void }) {
  const [password, setPassword] = useState('')

  const request = useMutation({
    mutationFn: async (value: string) => api.post('/privacy/export', { password: value }),
  })

  const error = request.error instanceof ApiError ? request.error : null

  return (
    <Card>
      <Body>نسخة من بياناتك</Body>
      <Caption>
        الملف مشفّر بكلمة تكتبها الآن ولا نحفظها. تنزيله من صفحة الويب أسهل، لأنه يحتاج أداة مثل
        7-Zip أو Keka لفتحه.
      </Caption>

      <Field label="كلمة مرور الملف" error={error?.fieldError('password')}>
        <Input value={password} onChangeText={setPassword} secureTextEntry textAlign="left" />
      </Field>

      <Button
        label="جهّز الملف"
        busy={request.isPending}
        disabled={password.length < 8}
        onPress={() =>
          request.mutate(password, {
            onSuccess: () => {
              setPassword('')
              onDone('جهّزنا الملف. نزّله من صفحة الويب.')
            },
          })
        }
      />
    </Card>
  )
}
