import * as SecureStore from 'expo-secure-store'
import { config } from '@/config'

/**
 * طبقة استهلاك الـAPI — **نفس عقد الويب حرفيًا**.
 *
 * كل استجابة بالشكل `{ success, message, data, errors }`، فالتعامل معه في
 * مكان واحد.
 *
 * ## الرمز في `SecureStore` لا في `AsyncStorage`
 *
 * `AsyncStorage` ملف نصّي عادي يقرأه أي شيء على جهاز مكسور الحماية. و
 * `SecureStore` يضعه في Keychain على iOS وKeystore على أندرويد. الرمز هنا
 * يفتح بيانات مالية كاملة، فالفرق ليس تفصيلًا.
 */

const TOKEN_KEY = 'qintar.token'

export class ApiError extends Error {
  readonly status: number

  readonly errors: Record<string, unknown> | null

  constructor(message: string, status: number, errors: Record<string, unknown> | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }

  get isValidation(): boolean {
    return this.status === 422
  }

  /** غرض يحتاج موافقة سارية — يحمل نوعها والبديل عنها. */
  get consentType(): string | null {
    const value = this.errors?.consent_type

    return typeof value === 'string' ? value : null
  }

  get consentFallback(): string | null {
    const value = this.errors?.fallback

    return typeof value === 'string' ? value : null
  }

  fieldError(field: string): string | undefined {
    const messages = this.errors?.[field]

    return Array.isArray(messages) ? (messages[0] as string) : undefined
  }
}

export interface ApiEnvelope<T> {
  success: boolean
  message: string | null
  data: T
  errors: Record<string, unknown> | null
  meta?: Record<string, unknown>
}

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    // جهاز يمنع المخزن الآمن: التطبيق يعمل للجلسة الحالية ولا ينهار.
    return null
  }
}

export async function setToken(token: string | null): Promise<void> {
  try {
    if (token === null) await SecureStore.deleteItemAsync(TOKEN_KEY)
    else await SecureStore.setItemAsync(TOKEN_KEY, token)
  } catch {
    /* تجاهل: لا نُسقط التطبيق لأن المخزن ممنوع */
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | (string | number)[]>
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${config.apiUrl}/api/v1${path}`)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === '') continue

    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(`${key}[]`, String(item))
    } else {
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  if (!config.isConfigured) {
    // **يُقال صراحةً.** تطبيق يشير لخادم خاطئ صامتًا أسوأ من واحد يعترف.
    throw new ApiError('عنوان الخادم غير مضبوط في هذي النسخة.', 0)
  }

  const token = await getToken()

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  let envelope: ApiEnvelope<T>

  try {
    envelope = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم.', response.status)
  }

  if (!response.ok || envelope.success === false) {
    if (response.status === 401) await setToken(null)

    throw new ApiError(envelope.message ?? 'صار خطأ.', response.status, envelope.errors)
  }

  return envelope
}

/** رفع ملف — `multipart`، وبلا `Content-Type` يدوي: الفاصل من المنصّة. */
export async function upload<T>(path: string, field: string, uri: string, name: string, type: string): Promise<ApiEnvelope<T>> {
  const token = await getToken()
  const form = new FormData()

  // React Native يقبل هذا الشكل، ولا يوجد `File` في بيئته.
  form.append(field, { uri, name, type } as unknown as Blob)

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: form,
  })

  const envelope = (await response.json()) as ApiEnvelope<T>

  if (!response.ok || envelope.success === false) {
    throw new ApiError(envelope.message ?? 'صار خطأ.', response.status, envelope.errors)
  }

  return envelope
}

export const api = {
  get: <T,>(path: string, query?: RequestOptions['query']) => request<T>(path, { query }),
  post: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload,
}
