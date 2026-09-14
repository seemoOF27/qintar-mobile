import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { LegalDocuments } from '@/api/types'
import { keys } from '@/api/hooks/keys'
import { Body, Button, Caption, Card, Notice, Screen, Title } from '@/components/ui'

/**
 * سياسة الخصوصية وشروط الاستخدام — **تُقرأ بلا تسجيل**.
 *
 * والنص من الخادم كما هو: البصمة المخزَّنة عند القبول تُحسب منه بالضبط.
 */
export function useLegalDocuments() {
  return useQuery({
    queryKey: keys.legal,
    queryFn: async () => (await api.get<LegalDocuments>('/legal')).data,
    staleTime: 5 * 60_000,
  })
}

export function LegalScreen({ onBack }: { onBack?: () => void }) {
  const { data, isPending, isError } = useLegalDocuments()

  return (
    <Screen>
      <Title>السياسة والشروط</Title>

      {isPending && <Body muted>لحظة…</Body>}
      {isError && <Notice tone="danger">تعذّر تحميل النص. حاول بعد قليل.</Notice>}

      {data !== undefined && (
        <>
          <Caption>النسخة {data.version}</Caption>
          <LegalText title="سياسة الخصوصية" text={data.privacy_policy} />
          <LegalText title="شروط الاستخدام" text={data.terms_of_use} />
        </>
      )}

      {onBack !== undefined && <Button label="رجوع" variant="ghost" onPress={onBack} />}
    </Screen>
  )
}

export function LegalText({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <Body>{title}</Body>
      {/* النص كما هو بلا محوّل Markdown: المحوّل يغيّر ما يُعرض، والبصمة تخص النص. */}
      <Caption>{text}</Caption>
    </Card>
  )
}
