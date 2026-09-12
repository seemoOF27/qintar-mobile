import { StyleSheet, Text } from 'react-native'
import { formatMoney, type Money as MoneyValue } from '@/lib/money'
import { usePrivacyDisplay } from '@/context/PrivacyContext'
import { theme } from '@/theme'

/**
 * عرض مبلغ.
 *
 * **المكان الوحيد الذي يُنسَّق فيه رقم مالي.** يمر بـ`formatMoney` وحدها،
 * فلا `parseFloat` ولا `toLocaleString` على مبلغ في أي شاشة.
 *
 * و`sensitive` تجعله يستجيب لزر إخفاء الأرقام — **إخفاء بصري لا تشفير**.
 */
export function MoneyText({
  amount,
  size = 'body',
  sensitive = false,
  tone,
}: {
  amount: MoneyValue
  size?: 'body' | 'title' | 'display' | 'figure'
  sensitive?: boolean
  tone?: 'positive' | 'danger' | 'muted'
}) {
  const { hidden } = usePrivacyDisplay()

  const masked = sensitive && hidden

  return (
    <Text
      style={[
        styles[size],
        tone === 'positive' && styles.positive,
        tone === 'danger' && styles.danger,
        tone === 'muted' && styles.muted,
      ]}
      // الرقم المخفي لا يُقرأ للقارئ الصوتي أيضًا، وإلا صار الإخفاء شكليًا.
      accessibilityLabel={masked ? 'مبلغ مخفي' : undefined}
    >
      {masked ? '••••' : `${formatMoney(amount)} ر.س`}
    </Text>
  )
}

const styles = StyleSheet.create({
  body: { fontSize: theme.fontSize.body, color: theme.color.inkStrong, textAlign: 'right' },
  title: {
    fontSize: theme.fontSize.title,
    fontWeight: '600',
    color: theme.color.inkStrong,
    textAlign: 'right',
  },
  display: {
    fontSize: theme.fontSize.display,
    fontWeight: '700',
    color: theme.color.inkStrong,
    textAlign: 'right',
  },
  figure: {
    fontSize: theme.fontSize.figure,
    fontWeight: '700',
    color: theme.color.brandPrimary,
    textAlign: 'right',
  },
  positive: { color: theme.color.statePositive },
  danger: { color: theme.color.stateDanger },
  muted: { color: theme.color.inkMuted },
})
