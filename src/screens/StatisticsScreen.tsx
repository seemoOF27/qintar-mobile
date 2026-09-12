import { useState } from 'react'
import { View } from 'react-native'
import { useStatistics } from '@/api/hooks/useQintar'
import { MoneyText } from '@/components/MoneyText'
import { Body, Button, Caption, Card, Divider, EmptyState, Notice, Row, Screen, Title } from '@/components/ui'
import { theme } from '@/theme'

/**
 * الإحصائيات.
 *
 * **كلها على `spent_at` لا `created_at`**: مصروف أُدخل اليوم وتاريخه الشهر
 * الماضي يخص الشهر الماضي — القسم ٥.٣.
 *
 * **والمولَّد تلقائيًا يُعرض منفصلًا** عن الصرف، فلا يختلط «ادّخرت» بـ«صرفت»
 * — القرار 12.5.
 */
const PERIODS = [
  { id: 'salary_cycle', label: 'الرحلة' },
  { id: 'month', label: 'الشهر' },
  { id: 'week', label: 'الأسبوع' },
]

export function StatisticsScreen() {
  const [period, setPeriod] = useState('salary_cycle')
  const { data, isPending } = useStatistics({ period })

  return (
    <Screen>
      <Title>الإحصائيات</Title>

      <View style={{ flexDirection: 'row', gap: theme.space['2'] }}>
        {PERIODS.map((item) => (
          <Button
            key={item.id}
            label={item.label}
            variant={period === item.id ? 'primary' : 'ghost'}
            onPress={() => setPeriod(item.id)}
          />
        ))}
      </View>

      {isPending && <Body muted>لحظة…</Body>}

      {data !== undefined && (
        <>
          <Card>
            <Caption>
              من {data.period.from} إلى {data.period.to}
            </Caption>

            <Row>
              <Body>الدخل</Body>
              <MoneyText amount={data.income.total} sensitive size="title" />
            </Row>
            <Row>
              <Caption>منه راتب</Caption>
              <MoneyText amount={data.income.salary} sensitive tone="muted" />
            </Row>
            <Row>
              <Caption>ومنه إضافي</Caption>
              <MoneyText amount={data.income.extra} sensitive tone="muted" />
            </Row>

            <Divider />

            <Row>
              <Body>الصرف</Body>
              <MoneyText amount={data.spending.total} sensitive size="title" />
            </Row>
            <Row>
              <Caption>عدد العمليات</Caption>
              <Body>{data.spending.transaction_count}</Body>
            </Row>
          </Card>

          {/* **منفصل عن الصرف**: الاقتطاع ليس صرفًا على شيء. */}
          <Card>
            <Body>تحرّك تلقائيًا</Body>
            <Row>
              <Caption>للاستثمار</Caption>
              <MoneyText amount={data.automatic.investment} sensitive tone="muted" />
            </Row>
            <Row>
              <Caption>للطوارئ</Caption>
              <MoneyText amount={data.automatic.emergency} sensitive tone="muted" />
            </Row>
            <Row>
              <Caption>للحصالات</Caption>
              <MoneyText amount={data.automatic.piggy_banks} sensitive tone="muted" />
            </Row>
          </Card>

          <Title>حسب الميزانية</Title>

          {data.spending.by_budget.length === 0 && <EmptyState title="ما فيه صرف مصنَّف." />}

          {data.spending.by_budget.map((row) => (
            <Card key={row.id}>
              <Row>
                <Body muted={row.is_archived}>{row.name}</Body>
                <MoneyText amount={row.spent} sensitive />
              </Row>
              <Row>
                <Caption>متبقٍّ</Caption>
                <MoneyText
                  amount={row.remaining}
                  sensitive
                  tone={row.overspent_by === '0.00' ? 'muted' : 'danger'}
                />
              </Row>
              {row.overspent_by !== '0.00' && (
                <Row>
                  <Caption>تجاوزت بـ</Caption>
                  <MoneyText amount={row.overspent_by} tone="danger" sensitive />
                </Row>
              )}
            </Card>
          ))}

          {data.spending.by_tag.rows.length > 0 && (
            <>
              <Title>حسب الوسم</Title>

              {/*
                **مجموع الوسوم قد يتجاوز الإجمالي** لأن العملية قد تحمل وسمين
                فتُحسب في كليهما. يُعلَن صراحةً فلا يظن المستخدم أن ثمة خطأً.
              */}
              {data.spending.by_tag.overlaps && (
                <Notice tone="info">
                  فيه عمليات تحمل أكثر من وسم، فتُحسب في كل واحد. مجموع البنود هنا قد يزيد على
                  الإجمالي، وهذا صحيح لا خطأ.
                </Notice>
              )}

              {data.spending.by_tag.rows.map((row) => (
                <Card key={row.id}>
                  <Row>
                    <Body>{row.name}</Body>
                    <MoneyText amount={row.spent} sensitive />
                  </Row>
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  )
}
