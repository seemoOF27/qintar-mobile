import { useState } from 'react'
import { View } from 'react-native'
import { ApiError } from '@/api/client'
import {
  useActiveCycle,
  useBudgets,
  useCommitments,
  useConfirmCycle,
  usePreviewCycle,
  useStatistics,
} from '@/api/hooks/useQintar'
import { MoneyText } from '@/components/MoneyText'
import {
  Body,
  Button,
  Caption,
  Card,
  Divider,
  EmptyState,
  Field,
  MoneyInput,
  Notice,
  Row,
  Screen,
  Title,
} from '@/components/ui'
import { percentOf } from '@/lib/money'
import { theme } from '@/theme'

/**
 * الرئيسية.
 *
 * **الرقم الأول هو المتبقي من الرحلة** لا الراتب: السؤال الذي يفتح المستخدم
 * التطبيق ليسأله هو «كم بقي لي»، لا «كم استلمت».
 *
 * وبلا رحلة جارية لا أرقام وهمية: تُعرض شاشة بدء الرحلة، **ولا تُنشأ رحلة
 * صامتة أبدًا** — القاعدة التاسعة.
 */
export function DashboardScreen() {
  const { data: cycle, isPending } = useActiveCycle()
  const { data: budgetData } = useBudgets()
  const { data: commitments } = useCommitments()
  const statistics = useStatistics({ period: 'salary_cycle' })

  if (isPending) {
    return (
      <Screen>
        <Body muted>لحظة…</Body>
      </Screen>
    )
  }

  if (cycle === null) {
    return (
      <Screen>
        <EmptyState title="ما بدأت رحلة راتب بعد. ابدأ واحدة لتظهر أرقامك." />
        <StartCyclePanel />
      </Screen>
    )
  }

  const budgets = budgetData?.budgets ?? []
  const unpaid = (commitments ?? []).filter((item) => !item.is_paid_current_cycle)
  const spendingRows = statistics.data?.spending.by_budget ?? []

  return (
    <Screen>
      <Card>
        <Caption>المتبقي من الرحلة</Caption>
        <MoneyText amount={cycle.available_balance} size="figure" sensitive />
        <Caption>
          من راتب بدأ {cycle.start_date}
        </Caption>

        <Divider />

        <Row>
          <Caption>الراتب</Caption>
          <MoneyText amount={cycle.income_amount} sensitive tone="muted" />
        </Row>
        <Row>
          <Caption>المصروف</Caption>
          <MoneyText amount={cycle.spent_amount} sensitive tone="muted" />
        </Row>
        <Row>
          <Caption>الاستثمار</Caption>
          <MoneyText amount={cycle.investment_allocated} sensitive tone="muted" />
        </Row>
        <Row>
          <Caption>الطوارئ</Caption>
          <MoneyText amount={cycle.emergency_allocated} sensitive tone="muted" />
        </Row>
      </Card>

      {/* التجاوز يُعرض صراحةً لا يُخفى في متبقٍّ سالب. */}
      {budgetData?.allocation?.exceeds === true && (
        <Notice tone="warning">
          مجموع ميزانياتك تجاوز المتاح. قلّص ميزانية أو عدّل نسب الاستثمار والطوارئ.
        </Notice>
      )}

      {unpaid.length > 0 && (
        <Notice tone="warning">باقي {unpaid.length} التزام ما سُدِّد هذي الرحلة.</Notice>
      )}

      <View style={{ gap: theme.space['2'] }}>
        <Title>الميزانيات</Title>

        {budgets.length === 0 && <EmptyState title="ما عندك ميزانيات بعد." />}

        {budgets.map((budget) => {
          const row = spendingRows.find((entry) => entry.id === budget.id)
          const spent = row?.spent ?? '0.00'
          const overspent = row !== undefined && row.overspent_by !== '0.00'

          return (
            <Card key={budget.id}>
              <Row>
                <Body muted={budget.is_archived}>{budget.name}</Body>
                <MoneyText
                  amount={row?.remaining ?? budget.computed_amount}
                  sensitive
                  tone={overspent ? 'danger' : undefined}
                />
              </Row>

              {/* شريط بصري فقط — النسبة لا تدخل في أي حساب مالي. */}
              <View style={styles.track}>
                <View
                  style={{
                    height: 6,
                    width: `${percentOf(spent, budget.computed_amount)}%`,
                    backgroundColor: overspent
                      ? theme.color.stateDanger
                      : theme.color.brandPrimary,
                    borderRadius: theme.radius.full,
                  }}
                />
              </View>

              <Row>
                <Caption>صرفت</Caption>
                <MoneyText amount={spent} sensitive tone="muted" />
              </Row>

              {overspent && row !== undefined && (
                <Row>
                  <Caption>تجاوزت بـ</Caption>
                  <MoneyText amount={row.overspent_by} tone="danger" sensitive />
                </Row>
              )}
            </Card>
          )
        })}
      </View>
    </Screen>
  )
}

const styles = {
  track: {
    height: 6,
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.full,
    overflow: 'hidden' as const,
  },
}

/**
 * بدء رحلة راتب.
 *
 * **معاينة ثم تأكيد صريح.** المعاينة لا تكتب حرفًا، والتأكيد هو الطريق
 * الوحيد للإنشاء — القاعدة التاسعة. والمستخدم يرى كل اقتطاع قبل أن يقع.
 */
function StartCyclePanel() {
  const preview = usePreviewCycle()
  const confirm = useConfirmCycle()
  const [income, setIncome] = useState('')

  const error =
    preview.error instanceof ApiError
      ? preview.error
      : confirm.error instanceof ApiError
        ? confirm.error
        : null

  const summary = preview.data

  return (
    <Card>
      <Title>ابدأ رحلة راتب</Title>

      <Field label="كم استلمت؟" error={error?.fieldError('income_amount')}>
        <MoneyInput value={income} onChangeText={setIncome} />
      </Field>

      {summary === undefined ? (
        <Button
          label="شوف الملخص"
          busy={preview.isPending}
          disabled={income === ''}
          onPress={() => preview.mutate(income)}
        />
      ) : (
        <View style={{ gap: theme.space['2'] }}>
          <Divider />
          <Caption>قبل ما تأكّد، هذا اللي بيصير:</Caption>

          <Row>
            <Body>للاستثمار</Body>
            <MoneyText amount={summary.investment_deduction} />
          </Row>
          <Row>
            <Body>للطوارئ</Body>
            <MoneyText amount={summary.emergency_deduction} />
          </Row>
          <Row>
            <Body>للحصالات</Body>
            <MoneyText amount={summary.piggy_bank_contributions} />
          </Row>

          <Divider />
          <Row>
            <Body>يبقى للصرف</Body>
            <MoneyText amount={summary.allocation_base} size="title" />
          </Row>

          {error !== null && !error.isValidation && <Notice tone="danger">{error.message}</Notice>}

          <Button
            label="أكّد وابدأ الرحلة"
            busy={confirm.isPending}
            onPress={() => confirm.mutate({ income_amount: income, trigger_method: 'manual' })}
          />

          <Button label="رجوع" variant="ghost" onPress={() => preview.reset()} />
        </View>
      )}
    </Card>
  )
}
