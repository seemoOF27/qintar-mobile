import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { ParseRequest } from '@/api/types'
import { keys } from './keys'

/**
 * تحليل الرسائل والفواتير — **أخطر مسار في التطبيق**.
 *
 * القاعدة الخامسة: يرسل بيانات مالية لطرف ثالث، فيحتاج موافقة `ai_parsing`
 * صريحة **وبديلًا يدويًا يعمل كاملًا بدونها**. ورفض الخادم يأتي بـ403 يحمل
 * `consent_type` و`fallback`، فالشاشة تعرض البديل لا رسالة عطل.
 *
 * **والاستطلاع مع مؤشر مرئي** — القاعدة الخامسة في `CLAUDE.md`: «عند إرسال
 * رسالة أو صورة للتحليل: مؤشر مرئي، لا معالجة صامتة أبدًا».
 */

export function useParseMessage() {
  return useMutation({
    mutationFn: async (text: string) =>
      (await api.post<ParseRequest>('/transactions/parse-sms', { text })).data,
  })
}

export function useParseReceipt() {
  return useMutation({
    mutationFn: async (input: { uri: string; name: string; type: string }) =>
      (
        await api.upload<ParseRequest>(
          '/transactions/parse-receipt',
          'receipt',
          input.uri,
          input.name,
          input.type,
        )
      ).data,
  })
}

/**
 * يستطلع حتى تنتهي الحالة.
 *
 * يتوقف عند `completed` أو `failed`: استطلاعٌ لا يتوقف يستهلك بطارية الجهاز
 * بلا فائدة، وهو أظهر ما يلاحظه المستخدم في تطبيق جوال.
 */
export function useParseRequest(id: number | null) {
  return useQuery({
    queryKey: keys.parseRequest(id ?? 0),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status

      return status === 'completed' || status === 'failed' ? false : 1500
    },
    queryFn: async () =>
      (await api.get<ParseRequest>(`/transactions/parse-requests/${id}`)).data,
  })
}

export function useSuggestCategory(merchantName: string) {
  return useQuery({
    queryKey: ['suggest-category', merchantName],
    enabled: merchantName.trim().length > 2,
    queryFn: async () =>
      (
        await api.get<{
          suggestion: { category_type: string; category_id: number; confidence: number } | null
        }>('/transactions/suggest-category', { merchant_name: merchantName })
      ).data.suggestion,
  })
}
