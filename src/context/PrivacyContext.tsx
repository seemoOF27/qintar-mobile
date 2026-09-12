import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'

/**
 * إخفاء الأرقام — **حالة واجهة لا تشفير**.
 *
 * القاعدة السابعة في `CLAUDE.md`: زر العين إخفاء بصري فقط، ولا يُوصف
 * كحماية. الأرقام تبقى في الذاكرة وفي الاستجابات؛ ما يتغيّر هو ما يُعرض على
 * الشاشة حين يكون أحد واقفًا وراءك.
 *
 * والتفضيل يُحفظ: من أخفى الأرقام يتوقع أن تبقى مخفية عند الفتح القادم.
 */
const KEY = 'qintar.numbers.hidden'

interface PrivacyState {
  hidden: boolean
  toggle: () => void
}

const PrivacyContext = createContext<PrivacyState | null>(null)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    void SecureStore.getItemAsync(KEY)
      .then((value) => setHidden(value === '1'))
      .catch(() => undefined)
  }, [])

  const toggle = useCallback(() => {
    setHidden((current) => {
      const next = !current

      void SecureStore.setItemAsync(KEY, next ? '1' : '0').catch(() => undefined)

      return next
    })
  }, [])

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle])

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacyDisplay(): PrivacyState {
  const context = useContext(PrivacyContext)

  if (context === null) throw new Error('usePrivacyDisplay خارج PrivacyProvider.')

  return context
}
