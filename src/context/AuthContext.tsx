import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, getToken, onPolicyAcceptanceRequired, setToken } from '@/api/client'
import type { User } from '@/api/types'

/**
 * المصادقة.
 *
 * **رمز Sanctum لا كوكيز**: الموبايل يشارك نفس الواجهة التي يستهلكها الويب،
 * فجلسات الخادم لا تصلح. والرمز ينتهي بثلاثة أيام خمول، ويُجدَّد مع كل طلب
 * مصادَق من الخادم نفسه.
 *
 * والحالة الأولى **`loading` لا `مسجَّل خارجًا`**: قراءة الرمز من المخزن
 * الآمن غير متزامنة، وافتراض الخروج قبلها يقفز بالمستخدم لشاشة الدخول ثم
 * يرجعه — ارتباك في كل إقلاع.
 */
interface AuthState {
  user: User | null
  status: 'loading' | 'authenticated' | 'anonymous'
  signIn: (token: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')

  const load = useCallback(async () => {
    if ((await getToken()) === null) {
      setUser(null)
      setStatus('anonymous')

      return
    }

    try {
      const me = await api.get<User>('/auth/me')

      setUser(me.data)
      setStatus('authenticated')
    } catch {
      // رمز منتهٍ أو ملغى: `client.ts` مسحه أصلًا عند 401.
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // تغيّرت السياسة أثناء الجلسة: يُعاد جلب الحساب فتظهر شاشة القبول.
  useEffect(() => onPolicyAcceptanceRequired(() => void load()), [load])

  const signIn = useCallback(
    async (token: string) => {
      await setToken(token)
      await load()
    },
    [load],
  )

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // الخادم غير متاح: يُمسح الرمز محليًّا في كل حال. مستخدم يضغط «خروج»
      // ويبقى داخلًا لأن الشبكة مقطوعة خللٌ أمني لا عطل شبكة.
    }

    await setToken(null)

    // **الكاش يُمسح كله.** أرقام الحساب السابق تبقى في الذاكرة بلا هذا،
    // فتظهر لمن يدخل بعده على نفس الجهاز.
    queryClient.clear()

    setUser(null)
    setStatus('anonymous')
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({ user, status, signIn, signOut, refresh: load }),
    [user, status, signIn, signOut, load],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)

  if (context === null) throw new Error('useAuth خارج AuthProvider.')

  return context
}
