import { useState } from 'react'
import { ApiError } from '@/api/client'
import { useLogin, useRegister, useResendCode, useVerifyEmail } from '@/api/hooks/useAuth'
import { useAuth } from '@/context/AuthContext'
import { Body, Button, Card, Field, Input, Notice, Screen, Title } from '@/components/ui'

/**
 * التسجيل ثم توثيق البريد ثم الدخول.
 *
 * **ثلاث خطوات لا خطوتان.** توثيق البريد لا يُصدر رمز دخول — الخادم يعيد
 * المستخدم وحده — فالدخول يقع بعده بكلمة المرور التي كُتبت أصلًا.
 *
 * وقبول سياسة الخصوصية وشروط الاستخدام **صريح ومسجَّل** — لا «بمتابعتك فأنت
 * موافق».
 */
export function RegisterScreen({ onBack }: { onBack: () => void }) {
  const { signIn } = useAuth()
  const register = useRegister()
  const verify = useVerifyEmail()
  const resend = useResendCode()
  const login = useLogin()

  const [stage, setStage] = useState<'form' | 'code'>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [code, setCode] = useState('')

  const error =
    register.error instanceof ApiError
      ? register.error
      : verify.error instanceof ApiError
        ? verify.error
        : login.error instanceof ApiError
          ? login.error
          : null

  if (stage === 'code') {
    return (
      <Screen>
        <Title>وصلك كود</Title>
        <Body muted>أرسلنا كودًا لـ{email}. اكتبه هنا.</Body>

        <Card>
          <Field label="الكود" error={error?.fieldError('code') ?? error?.fieldError('email')}>
            <Input
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />
          </Field>

          {error !== null && !error.isValidation && <Notice tone="danger">{error.message}</Notice>}

          <Button
            label="وثّق"
            busy={verify.isPending || login.isPending}
            disabled={code.length < 4}
            onPress={() =>
              verify.mutate(
                { email, code },
                {
                  // التوثيق لا يعطي رمزًا، فالدخول يقع بعده بكلمة المرور
                  // التي كُتبت في الخطوة الأولى.
                  onSuccess: () =>
                    login.mutate(
                      { email, password },
                      { onSuccess: (result) => void signIn(result.token) },
                    ),
                },
              )
            }
          />

          <Button
            label="أرسل الكود مرة ثانية"
            variant="ghost"
            busy={resend.isPending}
            onPress={() => resend.mutate(email)}
          />
        </Card>
      </Screen>
    )
  }

  return (
    <Screen>
      <Title>حساب جديد</Title>

      <Card>
        <Field label="اسمك" error={error?.fieldError('name')}>
          <Input value={name} onChangeText={setName} autoComplete="name" />
        </Field>

        <Field label="البريد" error={error?.fieldError('email')}>
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textAlign="left"
          />
        </Field>

        <Field label="كلمة المرور" error={error?.fieldError('password')}>
          <Input value={password} onChangeText={setPassword} secureTextEntry textAlign="left" />
        </Field>

        <Field label="أعِد كلمة المرور">
          <Input value={confirm} onChangeText={setConfirm} secureTextEntry textAlign="left" />
        </Field>

        {/*
          **قبول صريح لا صندوق مؤشَّر مسبقًا.** يبدأ مطفأً، وبلا ضغطه لا
          يُفعَّل زر الإنشاء — القاعدة الثالثة في CLAUDE.md.
        */}
        <Button
          label={accepted ? '✓ قرأت السياسة والشروط وأوافق' : 'اقرأ السياسة والشروط ووافق'}
          variant="ghost"
          onPress={() => setAccepted((current) => !current)}
        />

        {error !== null && !error.isValidation && <Notice tone="danger">{error.message}</Notice>}

        <Button
          label="أنشئ الحساب"
          busy={register.isPending}
          disabled={!accepted || name === '' || email === '' || password === ''}
          onPress={() =>
            register.mutate(
              { name, email, password, password_confirmation: confirm },
              { onSuccess: () => setStage('code') },
            )
          }
        />

        <Button label="عندي حساب" variant="ghost" onPress={onBack} />
      </Card>
    </Screen>
  )
}
