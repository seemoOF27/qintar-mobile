import { useMemo, useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { keys } from '@/api/hooks/keys'
import { useCashbackCatalog, useCashbackMappings, useCashbackSpend, useLinkCard, useUpdateMapping } from '@/api/hooks/useCashback'
import { useCards } from '@/api/hooks/useQintar'
import type { CashbackCatalog, CashbackSpend, PrivacyDashboard, UserCard } from '@/api/types'
import { Body, Button, Caption, Card, Divider, EmptyState, Notice, Row, Screen, Title } from '@/components/ui'
import { MoneyText } from '@/components/MoneyText'
import {
  cardFacts,
  engineCards,
  isCompleteSelection,
  monthlySelectionOf,
  rankForSpend,
  selectionComparison,
} from '@/lib/cashback'
import { formatEngineAmount } from '@/lib/money'
import { monthOf, shiftMonth } from '@/lib/month'
import { computeCard } from '@/vendor/cashback-engine'
import type { Card as EngineCard, CategoryId, Spend } from '@/vendor/cashback-engine'
import { theme } from '@/theme'

/**
 * بطاقتك مقابل صرفك — مطابقة لشاشة الويب.
 *
 * **الحساب على جهازك، وصرفك لا يغادر.** الخادم يعطي بيانات البطاقات المنشورة
 * وملف صرفك الشهري، والمحرك يحسب هنا — 0005 §١٣.٢.
 *
 * وما يفرض العقد ظهوره في الشاشة (`contracts/consent-and-transparency.md`):
 * شارة المصدر بتاريخها، وشارة التقادم مع سببها، والتنويه **بجانب كل نتيجة**،
 * والفئات المربوطة ظاهرة وفكّها متاح.
 */

const DISCLAIMER = 'تقديري ومبني على شروط منشورة — ليس عرضًا ولا استشارة مالية.'

const FAILURE_REASON: Record<string, string> = {
  schema_invalid: 'وصلت بيانات لا تطابق العقد فلم نعتمدها',
  rate_limited: 'منصة البطاقات طلبت التمهّل',
  server_error: 'منصة البطاقات فيها عطل مؤقت',
  unreachable: 'تعذّر الوصول لمنصة البطاقات',
}

const dateOnly = (value: string | null | undefined) => (value == null ? '—' : value.slice(0, 10))

export function CashbackScreen({ onBack }: { onBack: () => void }) {
  const privacy = useQuery({
    queryKey: keys.privacy,
    queryFn: async () => (await api.get<PrivacyDashboard>('/privacy')).data,
  })

  const granted = privacy.data?.consents.card_integration?.granted === true

  return (
    <Screen>
      <Button label="رجوع" variant="ghost" onPress={onBack} />
      <Title>بطاقتك مقابل صرفك</Title>

      {privacy.isPending ? <Body muted>لحظة…</Body> : granted ? <CashbackFeature /> : <ConsentGate onBack={onBack} />}
    </Screen>
  )
}

/**
 * **الإفصاح قبل التفعيل، بالنص الكامل** — لا صندوق مؤشَّر مسبقًا، ولا
 * «بمتابعتك فأنت موافق».
 */
function ConsentGate({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient()

  const text = useQuery({
    queryKey: keys.consentText('card_integration'),
    queryFn: async () =>
      (await api.get<{ text: string; fallback: string; version: string }>('/privacy/consents/card_integration/text')).data,
  })

  const grant = useMutation({
    mutationFn: async () => api.post('/privacy/consents/card_integration'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.privacy }),
  })

  return (
    <Card>
      {text.data === undefined ? (
        <Body muted>لحظة…</Body>
      ) : (
        <>
          <Body>{text.data.text}</Body>
          <Caption>لو ما فعّلتها: {text.data.fallback}</Caption>
          <Row>
            <Button label="فعّل الميزة" busy={grant.isPending} onPress={() => grant.mutate()} />
            <Button label="مو الحين" variant="ghost" onPress={onBack} />
          </Row>
        </>
      )}
    </Card>
  )
}

function CashbackFeature() {
  const current = monthOf(new Date())
  const [month, setMonth] = useState(current)
  const catalog = useCashbackCatalog(true)
  const spend = useCashbackSpend(true, month)

  const cards = useMemo(() => engineCards(catalog.data?.cards ?? []), [catalog.data])

  return (
    <>
      {catalog.data !== undefined && <SourceBadges catalog={catalog.data} />}

      <Card>
        <Caption>شهر تقويمي لا رحلة راتب: البنك يصفّر السقوف أول الشهر.</Caption>
        <Row>
          <Button label="الشهر السابق" variant="ghost" onPress={() => setMonth(shiftMonth(month, -1))} />
          <Body>{month}</Body>
          <Button
            label="التالي"
            variant="ghost"
            disabled={month >= current}
            onPress={() => setMonth(shiftMonth(month, 1))}
          />
        </Row>
      </Card>

      {spend.data !== undefined && <Coverage spend={spend.data} />}

      <Mappings />

      {catalog.data?.available === true && spend.data !== undefined && (
        <>
          <Comparison cards={cards} catalog={catalog.data} spend={spend.data.spend} />
          <MyCards cards={cards} catalog={catalog.data} month={month} spend={spend.data.spend} />
        </>
      )}
    </>
  )
}

/** شارتا المصدر والتقادم — إلزاميتان بالعقد. */
function SourceBadges({ catalog }: { catalog: CashbackCatalog }) {
  if (!catalog.available) {
    return (
      <Notice tone="warning">
        ما وصلتنا بيانات البطاقات بعد. تُجلب يوميًّا من منصة البطاقات
        {catalog.last_failure !== null && ` — آخر محاولة: ${FAILURE_REASON[catalog.last_failure] ?? 'تعذّرت'}`}.
      </Notice>
    )
  }

  return (
    <>
      <Caption>بيانات البطاقات بتاريخ {dateOnly(catalog.fetched_at)} · من منصة البطاقات · معلومات عامة لا تخصك</Caption>

      {catalog.is_stale && (
        <Notice tone="warning">
          بيانات البطاقات أقدم من أسبوع
          {catalog.last_failure !== null ? ` — ${FAILURE_REASON[catalog.last_failure] ?? 'تعذّر التحديث'}` : ''}. النتائج
          مبنية على آخر نسخة صالحة، وقد تكون الشروط تغيّرت.
        </Notice>
      )}
    </>
  )
}

/** مؤشرا التغطية — «يرى المستخدم ذلك صراحةً لا صامتًا». */
function Coverage({ spend }: { spend: CashbackSpend }) {
  return (
    <Card>
      <Row>
        <Body>صرفك هذا الشهر</Body>
        <MoneyText amount={spend.total} sensitive />
      </Row>

      <Caption>
        مصنَّف منه {spend.coverage_percent}٪. غير المصنَّف يُحسب «مشتريات أخرى محلية»، وقد تكون نسبته عندك أعلى أو
        أقل.
      </Caption>

      {spend.unmapped_budgets.length > 0 && (
        <Text style={{ color: theme.color.stateWarning, fontSize: theme.fontSize.caption, textAlign: 'right' }}>
          ميزانيات بلا فئة: {spend.unmapped_budgets.map((budget) => budget.name).join('، ')}
        </Text>
      )}

      {spend.transaction_count === 0 ? (
        <Caption>ما فيه مصروفات في هذا الشهر.</Caption>
      ) : (
        <Caption>
          مسند لبطاقة منه {spend.card_assigned_percent}٪ ({spend.card_assigned_count} من {spend.transaction_count} عملية).
          {spend.card_assigned_percent < 100 && ' الباقي ما يدخل في «كم كسبت فعلًا» لأي بطاقة.'}
        </Caption>
      )}
    </Card>
  )
}

/** اختيار من قائمة قصيرة — أهداف لمس ٤٤ نقطة فأكثر. */
function Chips<T extends string>({
  items,
  selected,
  onSelect,
}: {
  items: { key: T; label: string }[]
  selected: T | null
  onSelect: (key: T) => void
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
      {items.map((item) => (
        <Button
          key={item.key}
          label={item.label}
          variant={selected === item.key ? 'primary' : 'ghost'}
          onPress={() => onSelect(item.key)}
        />
      ))}
    </View>
  )
}

/**
 * ميزانياتك مقابل الفئات التسع.
 *
 * **الاقتراح يُعرض ولا يُطبَّق** — «اعتمده» ضغطة منك. والميزانية تبقى باسمك،
 * والفئة علامة تحتها (0005 §١٣.٣).
 */
function Mappings() {
  const { data } = useCashbackMappings(true)
  const update = useUpdateMapping()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  if (data === undefined) return null

  const labelOf = (key: string | null) => data.categories.find((category) => category.key === key)?.label_ar ?? key
  const mappedCount = data.budgets.filter((budget) => budget.canonical_category !== null).length
  const choices = [{ key: '', label: 'بلا ربط' }, ...data.categories.map((category) => ({ key: category.key, label: category.label_ar }))]

  return (
    <Card>
      <Button
        label={`ربط ميزانياتك بالفئات · ${mappedCount} من ${data.budgets.length}`}
        variant="ghost"
        onPress={() => setOpen((value) => !value)}
      />

      {open && (
        <>
          {data.budgets.length === 0 && <EmptyState title="ما عندك ميزانيات. أنشئ ميزانية لتربطها بفئة." />}

          {data.budgets.map((budget) => (
            <View key={budget.budget_id} style={{ gap: theme.space['2'] }}>
              <Divider />
              <Row>
                <Body>{budget.name}</Body>
                <Button
                  label={budget.canonical_category === null ? 'بلا ربط' : String(labelOf(budget.canonical_category))}
                  variant="ghost"
                  onPress={() => setEditing(editing === budget.budget_id ? null : budget.budget_id)}
                />
              </Row>

              {editing === budget.budget_id && (
                <Chips
                  items={choices}
                  selected={budget.canonical_category ?? ''}
                  onSelect={(key) => {
                    update.mutate({ budgetId: budget.budget_id, category: key === '' ? null : key })
                    setEditing(null)
                  }}
                />
              )}

              {budget.canonical_category === null && budget.suggestion !== null && (
                <Button
                  label={`مقترح: ${labelOf(budget.suggestion)} — اعتمده`}
                  variant="ghost"
                  onPress={() => update.mutate({ budgetId: budget.budget_id, category: budget.suggestion })}
                />
              )}
            </View>
          ))}

          <Caption>
            «المشتريات الدولية» ما نقترحها: هي صفة عملة لا نوع صرف. اربطها بنفسك لو ميزانية كلها من الخارج.
          </Caption>
        </>
      )}
    </Card>
  )
}

/** «لو صرفت كل شيء بهذه» — 0005 §١٣.٧: المقارنة أولًا. */
function Comparison({ cards, catalog, spend }: { cards: EngineCard[]; catalog: CashbackCatalog; spend: Spend }) {
  const ranked = useMemo(() => rankForSpend(cards, spend), [cards, spend])

  return (
    <>
      <Title>لو صرفت كل شيء ببطاقة واحدة</Title>

      {ranked.map((result, index) => {
        const facts = cardFacts(catalog.cards.find((card) => card.slug === result.card.id))
        const lost = result.lostToCaps + result.lostToTotalCap

        return (
          <Card key={result.card.id}>
            <Row>
              <Body>
                {index + 1}. {result.card.short}
              </Body>
              <Body>{formatEngineAmount(result.netAnnual)} ر.س سنويًا</Body>
            </Row>
            <Caption>{result.card.issuer}</Caption>

            <Row>
              <Caption>كاش باك شهري</Caption>
              <Caption>{formatEngineAmount(result.finalMonthly)} ر.س</Caption>
            </Row>
            <Row>
              <Caption>الرسوم السنوية</Caption>
              <Caption>{result.feeWaived ? 'معفاة بصرفك' : `${formatEngineAmount(result.effectiveFee)} ر.س`}</Caption>
            </Row>
            {lost > 0 && (
              <Row>
                <Caption>ضاع بالسقوف</Caption>
                <Caption>{formatEngineAmount(lost)} ر.س شهريًا</Caption>
              </Row>
            )}

            {result.card.fxUncertain === true && <Warning>رسوم العمليات الدولية غير مؤكدة من البنك.</Warning>}

            {facts.bonus !== null && (
              <Caption>
                مكافأة تسجيل: {facts.bonus.label_ar}
                {facts.bonus.validUntil !== undefined && ` · حتى ${dateOnly(facts.bonus.validUntil)}`} — خارج الرقم أعلاه.
              </Caption>
            )}

            {facts.unknown.length > 0 && (
              <Warning>ما نشرها البنك: {facts.unknown.join('، ')}. فالرقم قد لا يعكسها.</Warning>
            )}

            {/* **بجانب كل نتيجة** لا في التذييل وحده — العقد. */}
            <Caption>{DISCLAIMER}</Caption>
          </Card>
        )
      })}
    </>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: theme.color.stateWarning, fontSize: theme.fontSize.caption, textAlign: 'right' }}>
      {children}
    </Text>
  )
}

/**
 * بطاقاتك: ربطها بمنتج منشور، والاختيار الشهري، و«كم كسبت فعلًا».
 *
 * **من لا يجد بطاقته يختار أخرى ويُحسب لها** — أداة مقارنة لا سجل ملكية.
 */
function MyCards(props: { cards: EngineCard[]; catalog: CashbackCatalog; month: string; spend: Spend }) {
  const { data: userCards } = useCards()

  return (
    <>
      <Title>بطاقاتك</Title>

      {(userCards ?? []).length === 0 && (
        <EmptyState title="ما سجّلت بطاقات. أضفها من صفحة الويب لتعرف كم كسبت فعلًا من كل واحدة." />
      )}

      {(userCards ?? []).map((userCard) => (
        <MyCard key={userCard.id} userCard={userCard} {...props} />
      ))}
    </>
  )
}

function MyCard({
  userCard,
  cards,
  catalog,
  month,
  spend,
}: {
  userCard: UserCard
  cards: EngineCard[]
  catalog: CashbackCatalog
  month: string
  spend: Spend
}) {
  const link = useLinkCard()
  const linked = cards.find((card) => card.id === userCard.canonical_card_slug) ?? null
  const mechanism = linked === null ? null : monthlySelectionOf(linked)
  const own = useCashbackSpend(linked !== null, month, userCard.id)

  const [choosing, setChoosing] = useState(false)
  const [order, setOrder] = useState<string[]>(userCard.monthly_selection ?? [])
  const saved = linked !== null && isCompleteSelection(linked, userCard.monthly_selection)

  const labelOf = (key: string) => catalog.categories.find((category) => category.key === key)?.label_ar ?? key

  return (
    <Card>
      <Body>
        {userCard.name}
        {userCard.last_four !== null && ` ••${userCard.last_four}`}
      </Body>

      <Row>
        <Caption>{linked === null ? 'غير مربوطة ببطاقة منشورة' : `${linked.issuer} — ${linked.short}`}</Caption>
        <Button label={choosing ? 'إغلاق' : 'اختر'} variant="ghost" onPress={() => setChoosing((value) => !value)} />
      </Row>

      {choosing && (
        <>
          <Caption>لو ما لقيتها اختر الأقرب، ويُحسب لها.</Caption>
          <Chips
            items={[{ key: '', label: 'بلا ربط' }, ...cards.map((card) => ({ key: card.id, label: `${card.issuer} — ${card.short}` }))]}
            selected={userCard.canonical_card_slug ?? ''}
            onSelect={(key) => {
              link.mutate({ id: userCard.id, slug: key === '' ? null : key, selection: null })
              setOrder([])
              setChoosing(false)
            }}
          />
        </>
      )}

      {/* الاختيار الشهري: رقمان — بما اخترت، وبأفضل توزيع (0005 §١٣.٥). */}
      {linked !== null && mechanism !== null && (
        <View style={{ gap: theme.space['2'] }}>
          <Divider />
          <Caption>هذي البطاقة تخليك تختار كل شهر أي فئة تأخذ أي نسبة. رتّبها كما اخترتها في تطبيق بنكك:</Caption>

          {mechanism.tierRates.map((rate, index) => (
            <View key={index} style={{ gap: theme.space['1'] }}>
              <Caption>النسبة {formatEngineAmount(rate * 100)}٪</Caption>
              <Chips
                items={mechanism.selectable.map((category) => ({ key: category, label: labelOf(category) }))}
                selected={(order[index] as CategoryId | undefined) ?? null}
                onSelect={(category) => {
                  const next = [...order]
                  next[index] = category
                  setOrder(next)
                }}
              />
            </View>
          ))}

          <Button
            label="احفظ اختيار الشهر"
            variant="ghost"
            disabled={!isCompleteSelection(linked, order)}
            busy={link.isPending}
            onPress={() => link.mutate({ id: userCard.id, slug: linked.id, selection: order })}
          />

          {saved && <SelectionNumbers card={linked} spend={spend} order={userCard.monthly_selection as CategoryId[]} />}
        </View>
      )}

      {linked !== null && own.data !== undefined && (
        <ActualEarned card={linked} spendData={own.data} order={saved ? (userCard.monthly_selection as CategoryId[]) : null} />
      )}
    </Card>
  )
}

function SelectionNumbers({ card, spend, order }: { card: EngineCard; spend: Spend; order: CategoryId[] }) {
  const { best, chosen, lostMonthly } = selectionComparison(card, spend, order)

  return (
    <View style={{ gap: theme.space['1'], backgroundColor: theme.color.surfaceSunken, borderRadius: theme.radius.md, padding: theme.space['3'] }}>
      <Caption>بما اخترت: {formatEngineAmount(chosen.monthly)} ر.س شهريًا لو صرفت كل شيء بها</Caption>
      <Caption>بأفضل توزيع لصرفك: {formatEngineAmount(best.monthly)} ر.س</Caption>
      {lostMonthly > 0 ? (
        <Warning>تخسر {formatEngineAmount(lostMonthly)} ر.س شهريًا بتوزيعك الحالي.</Warning>
      ) : (
        <Caption>توزيعك هو الأفضل لصرفك.</Caption>
      )}
      <Caption>{DISCLAIMER}</Caption>
    </View>
  )
}

/** «كم كسبت فعلًا» — العمليات المسندة لهذي البطاقة وحدها. */
function ActualEarned({ card, spendData, order }: { card: EngineCard; spendData: CashbackSpend; order: CategoryId[] | null }) {
  const result = order === null ? computeCard(card, spendData.spend) : selectionComparison(card, spendData.spend, order).chosen

  return (
    <View style={{ gap: theme.space['1'] }}>
      <Divider />
      <Row>
        <Caption>صرفت بها في {spendData.transaction_count} عملية</Caption>
        <MoneyText amount={spendData.total} sensitive tone="muted" />
      </Row>
      <Body>كسبت منها تقريبًا {formatEngineAmount(result.monthly)} ر.س</Body>
      {spendData.transaction_count === 0 && (
        <Caption>ما فيه عمليات مسندة لهذي البطاقة. اختر البطاقة عند إضافة المصروف ليُحسب هنا.</Caption>
      )}
      <Caption>{DISCLAIMER}</Caption>
    </View>
  )
}
