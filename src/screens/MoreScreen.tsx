import { useState } from 'react'
import { View } from 'react-native'
import { ContactScreen } from '@/screens/ContactScreen'
import {
  useAllocations,
  useCards,
  useCommitments,
  useDebts,
  useMarkCommitmentPaid,
  usePiggyBanks,
} from '@/api/hooks/useQintar'
import { MoneyText } from '@/components/MoneyText'
import { Body, Button, Caption, Card, Divider, EmptyState, Row, Screen, Title } from '@/components/ui'
import { theme } from '@/theme'

/**
 * الالتزامات والحصالات والصناديق والديون والبطاقات.
 *
 * **قراءة وإجراءات بسيطة وحدها.** إنشاء الميزانيات والحصالات وتعديل نسب
 * الاقتطاع يبقى في الويب: شاشات إعداد طويلة تُضبط مرة، وتكرارها في تطبيق
 * جوال يضاعف سطح الخطأ في أرقام مالية بلا فائدة تُذكر.
 */
export function MoreScreen() {
  const { data: commitments } = useCommitments()
  const { data: piggyBanks } = usePiggyBanks()
  const { data: allocations } = useAllocations()
  const { data: debts } = useDebts()
  const { data: cards } = useCards()
  const markPaid = useMarkCommitmentPaid()
  const [showContact, setShowContact] = useState(false)

  if (showContact) {
    return <ContactScreen onBack={() => setShowContact(false)} />
  }

  return (
    <Screen>
      <Button label="تواصل معنا" variant="ghost" onPress={() => setShowContact(true)} />

      <Title>الالتزامات</Title>

      {(commitments ?? []).length === 0 && <EmptyState title="ما عندك التزامات." />}

      {(commitments ?? []).map((item) => (
        <Card key={item.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Body>{item.name}</Body>
              <Caption>يوم {item.due_day} من كل شهر</Caption>
            </View>
            <MoneyText amount={item.amount} sensitive />
          </Row>

          {item.is_paid_current_cycle ? (
            <Caption>سُدِّد هذي الرحلة ✓</Caption>
          ) : (
            /*
              **لا يُنشئ عملية** — القرار 12.7: من سدّد نقدًا يعلّمه وحده، ومن
              سدّده بمصروف يُسنده للالتزام فيُعلَّم تلقائيًا.
            */
            <Button
              label="علّمه مسدَّدًا"
              variant="ghost"
              busy={markPaid.isPending}
              onPress={() => markPaid.mutate(item.id)}
            />
          )}
        </Card>
      ))}

      <Title>الحصالات</Title>

      {(piggyBanks ?? []).length === 0 && <EmptyState title="ما عندك حصالات." />}

      {(piggyBanks ?? []).map((bank) => (
        <Card key={bank.id}>
          <Row>
            <Body>{bank.name}</Body>
            <MoneyText amount={bank.current_balance} sensitive />
          </Row>
          <Row>
            <Caption>يُقتطع لها شهريًا</Caption>
            <MoneyText amount={bank.monthly_contribution} sensitive tone="muted" />
          </Row>
        </Card>
      ))}

      <Title>الاستثمار والطوارئ</Title>

      {(allocations ?? []).map((fund) => (
        <Card key={fund.type}>
          <Row>
            <Body>{fund.type === 'investment' ? 'الاستثمار' : 'الطوارئ'}</Body>
            <MoneyText amount={fund.current_balance} sensitive />
          </Row>
        </Card>
      ))}

      <Title>الديون</Title>

      {(debts ?? []).length === 0 && <EmptyState title="ما عندك ديون مسجَّلة." />}

      {(debts ?? []).map((debt) => (
        <Card key={debt.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Body>{debt.counterparty_name}</Body>
              <Caption>{debt.type === 'owed_to_me' ? 'له عندي' : 'لي عنده'}</Caption>
            </View>
            <MoneyText amount={debt.remaining_amount} sensitive />
          </Row>
        </Card>
      ))}

      <Title>بطاقاتي</Title>

      {/* **آخر أربعة أرقام فقط** — القاعدة السادسة. لا رقم كامل ولا CVV. */}
      {(cards ?? []).length === 0 && <EmptyState title="ما عندك بطاقات مسجَّلة." />}

      {(cards ?? []).map((card) => (
        <Card key={card.id}>
          <Row>
            <Body>{card.name}</Body>
            <Caption>{card.last_four === null ? '—' : `•• ${card.last_four}`}</Caption>
          </Row>
          <Caption>{card.bank_name}</Caption>
        </Card>
      ))}

      <Divider />

      <Caption>
        إنشاء الميزانيات والحصالات وتعديل نسب الاقتطاع من صفحة الويب: شاشات إعداد تُضبط مرة، وتكرارها
        هنا يضاعف سطح الخطأ في أرقام مالية.
      </Caption>

      <View style={{ height: theme.space['6'] }} />
    </Screen>
  )
}
