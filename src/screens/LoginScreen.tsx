import { useState } from 'react'
import { ApiError } from '@/api/client'
import { useLogin } from '@/api/hooks/useAuth'
import { useAuth } from '@/context/AuthContext'
import { Body, Button, Card, Field, Input, Notice, Screen, Title } from '@/components/ui'
import { config } from '@/config'

/**
 * الدخول.
 *
 * **الرسالة الواحدة للبريد والكلمة معًا**: الخادم لا يقول أيّهما خطأ، فمن
 * يعرف أن البريد صحيح يعرف أن الحساب موجود.
 */
export function LoginScreen({ onRegister }: { onRegister: () => void }) {
  const { signIn } = useAuth()
  const login = useLogin()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const error = login.error instanceof ApiError ? login.error : null

  return (
    <Screen>
      <Title>قنطار</Title>
      <Body muted>راتبك وميزانياتك ومصروفاتك في مكان واحد.</Body>

      {!config.isConfigured && (
        <Notice tone="danger">
          عنوان الخادم غير مضبوط في هذي النسخة. لازم تُبنى من جديد بـ
          EXPO_PUBLIC_API_URL.
        </Notice>
      )}

      <Card>
        <Field label="البريد" error={error?.fieldError('email')}>
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textAlign="left"
          />
        </Field>

        <Field label="كلمة المرور" error={error?.fieldError('password')}>
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textAlign="left"
          />
        </Field>

        {error !== null && !error.isValidation && <Notice tone="danger">{error.message}</Notice>}

        <Button
          label="ادخل"
          busy={login.isPending}
          disabled={email === '' || password === ''}
          onPress={() =>
            login.mutate(
              { email, password },
              { onSuccess: (result) => void signIn(result.token) },
            )
          }
        />

        <Button label="ما عندي حساب" variant="ghost" onPress={onRegister} />
      </Card>
    </Screen>
  )
}
