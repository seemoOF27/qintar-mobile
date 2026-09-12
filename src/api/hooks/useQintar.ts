import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type {
  AllocationStatus,
  AutoAllocation,
  Budget,
  CyclePreview,
  Debt,
  FixedCommitment,
  PiggyBank,
  SalaryCycle,
  Statistics,
  Tag,
  Transaction,
  UserCard,
} from '@/api/types'
import { keys, moneyTouchingKeys } from './keys'

/**
 * الخطّافات — **نفس مسارات الويب حرفيًا**.
 *
 * لا منطق مالي هنا: الخادم يحسب، والتطبيق يعرض. أي حساب يتكرر في العميل
 * يتباعد عن الخادم يومًا ما، ويكون الفرق في رقم يبني عليه المستخدم قرارًا.
 */

function useMoneyMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of moneyTouchingKeys) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}

// ── الرحلة والأرقام ──────────────────────────────────────────────────────

export function useCycles() {
  return useQuery({
    queryKey: keys.cycles,
    queryFn: async () => (await api.get<SalaryCycle[]>('/salary-cycles')).data,
  })
}

/** الرحلة الجارية تُشتق من القائمة: لا مسار خادم لها، ولا حاجة لطلب ثانٍ. */
export function useActiveCycle() {
  const query = useCycles()

  return { ...query, data: query.data?.find((cycle) => cycle.status === 'active') ?? null }
}

export function useStatistics(params: { period: string; date?: string }) {
  return useQuery({
    queryKey: keys.statistics(params),
    queryFn: async () => (await api.get<Statistics>('/statistics', params)).data,
  })
}

/**
 * الميزانيات، ومعها حالة التوزيع من `meta`.
 *
 * `allocation.exceeds` تقول إن مجموع الميزانيات تجاوز المتاح — يُعرض صراحةً
 * لا يُخفى في متبقٍّ سالب.
 */
export function useBudgets() {
  return useQuery({
    queryKey: keys.budgets,
    queryFn: async () => {
      const envelope = await api.get<Budget[]>('/budgets')

      return {
        budgets: envelope.data,
        allocation: (envelope.meta?.allocation ?? null) as AllocationStatus | null,
      }
    },
  })
}

export function useCommitments() {
  return useQuery({
    queryKey: keys.commitments,
    queryFn: async () => (await api.get<FixedCommitment[]>('/fixed-commitments')).data,
  })
}

export function usePiggyBanks() {
  return useQuery({
    queryKey: keys.piggyBanks,
    queryFn: async () => (await api.get<PiggyBank[]>('/piggy-banks')).data,
  })
}

export function useAllocations() {
  return useQuery({
    queryKey: keys.allocations,
    queryFn: async () => (await api.get<AutoAllocation[]>('/auto-allocations')).data,
  })
}

export function useDebts() {
  return useQuery({
    queryKey: keys.debts(),
    queryFn: async () => (await api.get<Debt[]>('/debts')).data,
  })
}

export function useCards() {
  return useQuery({
    queryKey: keys.cards,
    queryFn: async () => (await api.get<UserCard[]>('/user-cards')).data,
  })
}

export function useTags(scope?: string) {
  return useQuery({
    queryKey: [...keys.tags, scope ?? 'all'],
    queryFn: async () => (await api.get<Tag[]>('/tags', scope === undefined ? {} : { scope })).data,
  })
}

export function useTransactions(filters: Record<string, string | number> = {}) {
  return useQuery({
    queryKey: keys.transactions(filters),
    queryFn: async () => (await api.get<Transaction[]>('/transactions', filters)).data,
  })
}

// ── الكتابة ──────────────────────────────────────────────────────────────

export function useSaveTransaction() {
  return useMoneyMutation(async (input: Record<string, unknown> & { id?: number }) => {
    const { id, ...body } = input

    return id === undefined
      ? (await api.post<Transaction>('/transactions', body)).data
      : (await api.put<Transaction>(`/transactions/${id}`, body)).data
  })
}

export function useDeleteTransaction() {
  return useMoneyMutation(async (id: number) => api.delete(`/transactions/${id}`))
}

/**
 * تعليم التزام مسدَّدًا.
 *
 * **لا يُنشئ عملية** — القرار 12.7: من سدّد نقدًا يعلّمه وحده، ومن سدّده
 * بمصروف يُسنده للالتزام فيُعلَّم تلقائيًا.
 */
export function useMarkCommitmentPaid() {
  return useMoneyMutation(async (id: number) => api.post(`/fixed-commitments/${id}/mark-paid`))
}

/**
 * سحب من حصالة.
 *
 * **لا إيداع يدوي**: الحصالة تُموَّل بالاقتطاع التلقائي عند بدء الرحلة وحده،
 * فلا مسار إيداع في الخادم أصلًا.
 */
export function useWithdrawFromPiggyBank() {
  return useMoneyMutation(async ({ id, amount }: { id: number; amount: string }) =>
    api.post(`/piggy-banks/${id}/withdraw`, { amount }),
  )
}

export function useRecordDebtPayment() {
  return useMoneyMutation(
    async ({ debtId, amount, note }: { debtId: number; amount: string; note?: string }) =>
      api.post(`/debts/${debtId}/payments`, { amount, ...(note === undefined ? {} : { note }) }),
  )
}

/** المعاينة **لا تكتب حرفًا**، فهي طفرة بلا إبطال كاش. */
export function usePreviewCycle() {
  return useMutation({
    mutationFn: async (incomeAmount: string) =>
      (await api.post<CyclePreview>('/salary-cycles/preview', { income_amount: incomeAmount })).data,
  })
}

/**
 * **الطريق الوحيد** لإنشاء رحلة — القاعدة التاسعة.
 *
 * `confirmed: true` شرط الخادم نفسه: لا إنشاء صامت، ولا رحلة بلا أن يرى
 * المستخدم ملخصها ويؤكده.
 */
export function useConfirmCycle() {
  return useMoneyMutation(
    async (input: { income_amount: string; trigger_method: string }) =>
      (await api.post<SalaryCycle>('/salary-cycles/confirm', { ...input, confirmed: true })).data,
  )
}
