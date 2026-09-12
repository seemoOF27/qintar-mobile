import { useEffect, useState } from 'react'
import { View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ApiError } from '@/api/client'
import { useBudgets, useCards, useCommitments, usePiggyBanks, useSaveTransaction, useTags } from '@/api/hooks/useQintar'
import { useParseMessage, useParseReceipt, useParseRequest } from '@/api/hooks/useParsing'
import {
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Field,
  Input,
  MoneyInput,
  Notice,
  Row,
  Screen,
  Title,
} from '@/components/ui'
import { theme } from '@/theme'

/**
 * إضافة مصروف — **فورم المراجعة الموحّد**.
 *
 * القسم ٥.٥: مسارات الإدخال الثلاثة كلها تنتهي هنا قبل الحفظ. **لا حفظ
 * مباشر من مصدر آلي بلا تأكيد المستخدم**، مهما بلغت ثقة المزوّد.
 *
 * وأربع قواعد مرئية في هذي الشاشة:
 *
 * - **البطاقة اختيارية دائمًا** ولا تمنع الحفظ — القاعدة السادسة.
 * - **الوسوم لا تُورَث من الميزانية**؛ تُختار هنا صراحةً.
 * - **مؤشر «يُرسل للتحليل…» مرئي** ولا معالجة صامتة — القاعدة الخامسة.
 * - **البديل اليدوي يعمل كاملًا** بلا موافقة التحليل.
 */
export function AddExpenseScreen() {
  const save = useSaveTransaction()
  const { data: budgetData } = useBudgets()
  const { data: commitments } = useCommitments()
  const { data: piggyBanks } = usePiggyBanks()
  const { data: cards } = useCards()
  const { data: tags } = useTags('transaction')

  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [spentAt, setSpentAt] = useState(new Date().toISOString().slice(0, 10))
  const [categoryType, setCategoryType] = useState<string>('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [cardId, setCardId] = useState<number | null>(null)
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const error = save.error instanceof ApiError ? save.error : null

  // الميزانيات المعطّلة تُعرض للقراءة ولا تقبل مصروفًا جديدًا — القرار 12.9.
  const openBudgets = (budgetData?.budgets ?? []).filter((budget) => budget.accepts_new_expenses)

  const options =
    categoryType === 'budget'
      ? openBudgets.map((item) => ({ id: item.id, name: item.name }))
      : categoryType === 'commitment'
        ? (commitments ?? []).map((item) => ({ id: item.id, name: item.name }))
        : categoryType === 'piggybank'
          ? (piggyBanks ?? []).map((item) => ({ id: item.id, name: item.name }))
          : []

  return (
    <Screen>
      <Title>إضافة مصروف</Title>

      {/* المسار الآلي يعبّي الفورم، ولا يحفظ شيئًا بنفسه. */}
      <SmartInputPanel
        onExtracted={(draft) => {
          if (draft.amount !== null) setAmount(draft.amount)
          if (draft.merchant_name !== null) setMerchant(draft.merchant_name)
          if (draft.spent_at !== null) setSpentAt(draft.spent_at)

          setNotice('عبّينا اللي قدرنا نقراه. راجعه قبل الحفظ.')
        }}
      />

      {notice !== null && <Notice tone="positive">{notice}</Notice>}

      <Card>
        <Field label="المبلغ" error={error?.fieldError('amount')}>
          <MoneyInput value={amount} onChangeText={setAmount} />
        </Field>

        <Field label="التاجر" error={error?.fieldError('merchant_name')}>
          <Input value={merchant} onChangeText={setMerchant} />
        </Field>

        <Field label="تاريخ الصرف" hint="بصيغة سنة-شهر-يوم">
          <Input value={spentAt} onChangeText={setSpentAt} textAlign="left" />
        </Field>

        <Divider />

        <Field label="على أي باب؟" hint="اختياري">
          <Chips
            items={[
              { id: 'budget', name: 'ميزانية' },
              { id: 'commitment', name: 'التزام' },
              { id: 'piggybank', name: 'حصالة' },
            ]}
            selected={categoryType === '' ? [] : [categoryType]}
            onToggle={(id) => {
              setCategoryType((current) => (current === id ? '' : String(id)))
              setCategoryId(null)
            }}
          />
        </Field>

        {categoryType !== '' && (
          <Field label="أي واحدة؟" error={error?.fieldError('category_id')}>
            <Chips
              items={options}
              selected={categoryId === null ? [] : [categoryId]}
              onToggle={(id) => setCategoryId((current) => (current === id ? null : Number(id)))}
            />
          </Field>
        )}

        {/* **اختيارية دائمًا** — لا تمنع حفظ العملية. القاعدة السادسة. */}
        <Field label="البطاقة" hint="اختيارية — العملية تُحفظ بدونها">
          <Chips
            items={(cards ?? []).map((card) => ({
              id: card.id,
              name: card.last_four === null ? card.name : `${card.name} ••${card.last_four}`,
            }))}
            selected={cardId === null ? [] : [cardId]}
            onToggle={(id) => setCardId((current) => (current === id ? null : Number(id)))}
          />
        </Field>

        {(tags ?? []).length > 0 && (
          <Field label="الوسوم" hint="تُختار هنا صراحةً — لا تُورَث من الميزانية">
            <Chips
              items={(tags ?? []).map((tag) => ({ id: tag.id, name: tag.name }))}
              selected={selectedTags}
              onToggle={(id) =>
                setSelectedTags((current) =>
                  current.includes(Number(id))
                    ? current.filter((item) => item !== Number(id))
                    : [...current, Number(id)],
                )
              }
            />
          </Field>
        )}

        {error !== null && !error.isValidation && <Notice tone="danger">{error.message}</Notice>}

        <Button
          label="احفظ"
          busy={save.isPending}
          disabled={amount === '' || merchant === ''}
          onPress={() =>
            save.mutate(
              {
                type: 'expense',
                input_method: 'manual',
                amount,
                merchant_name: merchant,
                spent_at: spentAt,
                ...(categoryType === '' || categoryId === null
                  ? {}
                  : { category_type: categoryType, category_id: categoryId }),
                ...(cardId === null ? {} : { user_card_id: cardId }),
                ...(selectedTags.length === 0 ? {} : { tags: selectedTags }),
              },
              {
                onSuccess: () => {
                  setAmount('')
                  setMerchant('')
                  setSelectedTags([])
                  setNotice('حُفظت العملية.')
                },
              },
            )
          }
        />
      </Card>
    </Screen>
  )
}

/**
 * الإدخال الذكي — رسالة بنكية أو صورة فاتورة.
 *
 * **بلا موافقة `ai_parsing` يرفض الخادم بـ403** ويحمل البديل نصًّا، فيُعرض
 * كما هو. لا رسالة عطل، ولا شاشة إقناع، والفورم اليدوي فوقه يعمل كاملًا.
 */
function SmartInputPanel({
  onExtracted,
}: {
  onExtracted: (draft: NonNullable<import('@/api/types').ParseRequest['result']>) => void
}) {
  const parseMessage = useParseMessage()
  const parseReceipt = useParseReceipt()
  const [requestId, setRequestId] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  const { data: parsed } = useParseRequest(requestId)

  useEffect(() => {
    if (parsed?.status === 'completed' && parsed.result !== null) {
      onExtracted(parsed.result)
      setRequestId(null)
      setText('')
    }
  }, [parsed, onExtracted])

  const refusal =
    parseMessage.error instanceof ApiError
      ? parseMessage.error
      : parseReceipt.error instanceof ApiError
        ? parseReceipt.error
        : null

  const working = parsed?.status === 'queued' || parsed?.status === 'processing'

  async function pickReceipt() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })

    if (picked.canceled) return

    const asset = picked.assets[0]

    parseReceipt.mutate(
      {
        uri: asset.uri,
        name: asset.fileName ?? 'receipt.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      },
      { onSuccess: (request) => setRequestId(request.id) },
    )
  }

  if (!open) {
    return <Button label="اقرأها من رسالة أو فاتورة" variant="ghost" onPress={() => setOpen(true)} />
  }

  return (
    <Card>
      <Row>
        <Body>إدخال ذكي</Body>
        <Button label="إغلاق" variant="ghost" onPress={() => setOpen(false)} />
      </Row>

      {/*
        **المؤشر مرئي ولا معالجة صامتة** — القاعدة الخامسة. ويقول أين ذهبت
        البيانات، لا مجرد «جارٍ…».
      */}
      {working && (
        <Notice tone="info">
          يُرسل للتحليل… بياناتك عند المزوّد الآن. تقدر تدخلها يدويًا فوق بدل ما تنتظر.
        </Notice>
      )}

      {parsed?.status === 'failed' && (
        <Notice tone="warning">{parsed.failure_reason ?? 'تعذّر التحليل. أدخلها يدويًا.'}</Notice>
      )}

      {/* رفض بوابة الموافقة: يُعرض البديل نصًّا كما أرسله الخادم. */}
      {refusal?.consentType === 'ai_parsing' && (
        <Notice tone="warning">
          {refusal.consentFallback ?? 'التحليل يحتاج موافقتك من شاشة الخصوصية.'}
        </Notice>
      )}

      {refusal !== null && refusal.consentType === null && (
        <Notice tone="danger">{refusal.message}</Notice>
      )}

      <Field label="الصق نص الرسالة البنكية">
        <Input value={text} onChangeText={setText} multiline numberOfLines={4} />
      </Field>

      <Button
        label="حلّل الرسالة"
        busy={parseMessage.isPending || working}
        disabled={text.trim().length < 10}
        onPress={() =>
          parseMessage.mutate(text, { onSuccess: (request) => setRequestId(request.id) })
        }
      />

      <Button
        label="اختر صورة فاتورة"
        variant="ghost"
        busy={parseReceipt.isPending}
        onPress={() => void pickReceipt()}
      />

      <Caption>
        الرسالة أو الصورة تُرسل لمزوّد خارجي لتُقرأ، وما يرجع **مسودة تراجعها** لا عملية محفوظة.
      </Caption>
    </Card>
  )
}

/** اختيار من قائمة قصيرة — أهداف لمس ٤٤ نقطة فأكثر. */
function Chips({
  items,
  selected,
  onToggle,
}: {
  items: { id: number | string; name: string }[]
  selected: (number | string)[]
  onToggle: (id: number | string) => void
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
      {items.map((item) => (
        <Button
          key={item.id}
          label={selected.includes(item.id) ? `✓ ${item.name}` : item.name}
          variant={selected.includes(item.id) ? 'primary' : 'ghost'}
          onPress={() => onToggle(item.id)}
        />
      ))}
    </View>
  )
}
