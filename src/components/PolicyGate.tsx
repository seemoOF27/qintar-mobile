import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { User } from '@/api/types'
import { useAuth } from '@/context/AuthContext'
import { Body, Button, Caption, Card, Notice, Row, Screen, Title } from '@/components/ui'
import { LegalText, useLegalDocuments } from '@/screens/LegalScreen'
import { theme } from '@/theme'

/**
 * بوابة السياسة — **مستويان**، مطابقة للويب.
 *
 * - **تغيير جوهري**: شاشة كاملة، والخادم يرفض ما عداها بـ403.
 * - **تحديث بسيط**: شريط لا يمس الاستخدام.
 *
 * **ولا تُحتجز البيانات رهينة**: من لا يوافق يدخل شاشة الخصوصية فيصدّر ويحذف.
 */
function useAcceptPolicy() {
  const { refresh } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => (await api.post<User>('/legal/accept')).data,
    onSuccess: async () => {
      await refresh()
      void queryClient.invalidateQueries()
    },
  })
}

export function PolicyGate({
  children,
  privacyScreen,
}: {
  children: ReactNode
  /** شاشة الخصوصية تُمرَّر، فتُفتح من داخل البوابة لمن لا يوافق. */
  privacyScreen: ReactNode
}) {
  const { user } = useAuth()
  const [openPrivacy, setOpenPrivacy] = useState(false)

  if (user?.policy_acceptance_required === true) {
    if (openPrivacy) {
      return (
        <View style={{ flex: 1 }}>
          <Notice tone="warning">التطبيق متوقف لحين ما توافق على النسخة الجديدة.</Notice>
          <Button label="ارجع للموافقة" variant="ghost" onPress={() => setOpenPrivacy(false)} />
          {privacyScreen}
        </View>
      )
    }

    return <RequiredAcceptance onOpenPrivacy={() => setOpenPrivacy(true)} />
  }

  return (
    <View style={{ flex: 1 }}>
      {user?.policy_update_available === true && <MinorUpdateBanner />}
      {children}
    </View>
  )
}

function RequiredAcceptance({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
  const { data } = useLegalDocuments()
  const accept = useAcceptPolicy()
  const [readAll, setReadAll] = useState(false)

  return (
    <Screen>
      <Title>تحديث يحتاج موافقتك</Title>

      <Notice tone="warning">
        غيّرنا سياسة الخصوصية أو شروط الاستخدام تغييرًا يحتاج موافقتك. التطبيق متوقف لحين ما تقرأها
        وتوافق.
      </Notice>

      {data !== undefined && (
        <>
          <LegalText title="سياسة الخصوصية" text={data.privacy_policy} />
          <LegalText title="شروط الاستخدام" text={data.terms_of_use} />

          {/* **قبول صريح لا مؤشَّر مسبقًا**، والزر معطَّل قبله. */}
          <Button
            label={readAll ? `✓ قرأت النسخة ${data.version} وأوافق` : `قرأت النسخة ${data.version} وأوافق`}
            variant={readAll ? 'primary' : 'ghost'}
            onPress={() => setReadAll((current) => !current)}
          />

          <Button
            label="أوافق وأكمل"
            disabled={!readAll}
            busy={accept.isPending}
            onPress={() => accept.mutate()}
          />
        </>
      )}

      <Card>
        <Body>ما توافق؟</Body>
        <Caption>ما نحتجز بياناتك. تقدر تصدّرها وتحذف حسابك بلا ما توافق على شي.</Caption>
        <Button label="صدّر بياناتي أو احذف حسابي" variant="ghost" onPress={onOpenPrivacy} />
      </Card>
    </Screen>
  )
}

function MinorUpdateBanner() {
  const accept = useAcceptPolicy()
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return (
    <View
      style={{
        padding: theme.space['3'],
        backgroundColor: theme.color.surfaceSunken,
        gap: theme.space['2'],
      }}
    >
      <Caption>حدّثنا السياسة والشروط تحديثًا بسيطًا ما يغيّر شي في استخدامك.</Caption>
      <Row>
        <Button label="اطّلعت" busy={accept.isPending} onPress={() => accept.mutate()} />
        <Button label="إخفاء" variant="ghost" onPress={() => setHidden(true)} />
      </Row>
    </View>
  )
}
