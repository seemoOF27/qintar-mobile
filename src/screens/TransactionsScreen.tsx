import { useTransactions } from '@/api/hooks/useQintar'
import { MoneyText } from '@/components/MoneyText'
import { Body, Caption, Card, EmptyState, Row, Screen, Title } from '@/components/ui'
import { View } from 'react-native'

/**
 * سجل العمليات.
 *
 * **المولَّد تلقائيًا يُعلَّم صراحةً** فلا يظنه المستخدم صرفًا منه: الاقتطاع
 * للاستثمار ليس «صرفًا على شيء» — القرار 12.5.
 *
 * وما عدّله المستخدم بعد قراءة آلية يُعلَّم كذلك: يفرّق بين ما قرأه النظام
 * وما صحّحه صاحبه.
 */
export function TransactionsScreen() {
  const { data, isPending } = useTransactions({ include_auto: 1 })

  return (
    <Screen>
      <Title>العمليات</Title>

      {isPending && <Body muted>لحظة…</Body>}

      {data !== undefined && data.length === 0 && <EmptyState title="ما فيه عمليات بعد." />}

      {(data ?? []).map((transaction) => (
        <Card key={transaction.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Body>{transaction.merchant_name ?? 'بلا تاجر'}</Body>
              <Caption>{transaction.spent_at}</Caption>
            </View>

            <MoneyText
              amount={transaction.amount}
              sensitive
              tone={transaction.is_outgoing ? undefined : 'positive'}
            />
          </Row>

          {transaction.is_auto_generated && <Caption>حركة تلقائية — ليست صرفًا منك</Caption>}

          {transaction.input_method !== 'manual' && (
            <Caption>
              {transaction.input_method === 'bank_sms' ? 'من رسالة بنكية' : 'من صورة فاتورة'}
              {transaction.was_edited_by_user ? ' — عدّلتها' : ''}
            </Caption>
          )}

          {(transaction.tags ?? []).length > 0 && (
            <Caption>{(transaction.tags ?? []).map((tag) => tag.name).join(' · ')}</Caption>
          )}
        </Card>
      ))}
    </Screen>
  )
}
