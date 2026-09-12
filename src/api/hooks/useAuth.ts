import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { User } from '@/api/types'
import { Platform } from 'react-native'

/**
 * الدخول والتسجيل.
 *
 * `device_name` اسم الجهاز كما يسمّيه المستخدم في شاشة الأجهزة: من يرى
 * «iPhone» يعرف أيّ رمز يُلغي، ومن يرى سلسلة هوية متصفح لا يعرف شيئًا.
 */

interface LoginResult {
  token: string
  user: User
}

function deviceName(): string {
  return Platform.OS === 'ios' ? 'iPhone' : 'Android'
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) =>
      (await api.post<LoginResult>('/auth/login', { ...input, device_name: deviceName() })).data,
  })
}

/**
 * التسجيل.
 *
 * **`accepts_terms` شرط الخادم** لا إضافة اختيارية: القبول الصريح يُسجَّل في
 * `user_consents` بنوع `service`. والشاشة لا تُفعّل الزر قبل أن يُضغط.
 */
export function useRegister() {
  return useMutation({
    mutationFn: async (input: {
      name: string
      email: string
      password: string
      password_confirmation: string
    }) => (await api.post<User>('/auth/register', { ...input, accepts_terms: true })).data,
  })
}

/**
 * توثيق البريد — **لا يُصدر رمز دخول**.
 *
 * الخادم يعيد المستخدم وحده، والدخول خطوة تالية. كان هذا الخطّاف يتوقع
 * رمزًا فأظهر تدفّقٌ حقيقي أنه لا وجود له، وكان سيُسقط الشاشة عند أول تسجيل.
 */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (input: { email: string; code: string }) =>
      (await api.post<User>('/auth/verify-email', input)).data,
  })
}

export function useResendCode() {
  return useMutation({
    mutationFn: async (email: string) => api.post('/auth/resend-code', { email }),
  })
}
