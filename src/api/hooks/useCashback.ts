import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { CashbackCatalog, CashbackMappings, CashbackSpend, UserCard } from '@/api/types'
import { keys } from './keys'

/**
 * «بطاقتك مقابل صرفك».
 *
 * **الخادم يعطي البيانات، والحساب هنا.** المحرك يعمل على الجهاز على ملف الصرف
 * — 0005 §١٣.٢ — ولا طلب واحد يرسل صرفًا لأي جهة.
 */
const base = ['cashback'] as const

export function useCashbackCatalog(enabled: boolean) {
  return useQuery({
    queryKey: [...base, 'cards'],
    enabled,
    queryFn: async () => (await api.get<CashbackCatalog>('/cashback/cards')).data,
  })
}

export function useCashbackSpend(enabled: boolean, month: string, userCardId?: number) {
  return useQuery({
    queryKey: [...base, 'spend', month, userCardId ?? null],
    enabled,
    queryFn: async () =>
      (await api.get<CashbackSpend>('/cashback/spend', { month, user_card_id: userCardId })).data,
  })
}

export function useCashbackMappings(enabled: boolean) {
  return useQuery({
    queryKey: [...base, 'mappings'],
    enabled,
    queryFn: async () => (await api.get<CashbackMappings>('/cashback/mappings')).data,
  })
}

export function useUpdateMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { budgetId: number; category: string | null }) =>
      api.put(`/cashback/mappings/${input.budgetId}`, { canonical_category: input.category }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: base }),
  })
}

export function useLinkCard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: number; slug: string | null; selection: string[] | null }) =>
      (
        await api.put<UserCard>(`/cashback/user-cards/${input.id}`, {
          canonical_card_slug: input.slug,
          monthly_selection: input.selection,
        })
      ).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: base })
      void queryClient.invalidateQueries({ queryKey: keys.cards })
    },
  })
}
