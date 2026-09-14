import { useState } from 'react'
import { I18nManager, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { PrivacyProvider, usePrivacyDisplay } from '@/context/PrivacyContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Body, Button } from '@/components/ui'
import { DashboardScreen } from '@/screens/DashboardScreen'
import { AddExpenseScreen } from '@/screens/AddExpenseScreen'
import { StatisticsScreen } from '@/screens/StatisticsScreen'
import { TransactionsScreen } from '@/screens/TransactionsScreen'
import { MoreScreen } from '@/screens/MoreScreen'
import { PrivacyScreen } from '@/screens/PrivacyScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { RegisterScreen } from '@/screens/RegisterScreen'
import { LegalScreen } from '@/screens/LegalScreen'
import { PolicyGate } from '@/components/PolicyGate'
import { theme } from '@/theme'

/**
 * جذر التطبيق.
 *
 * **لا مكتبة مراقبة أخطاء محمَّلة هنا** — القاعدة الرابعة: عدم التحميل أقوى
 * من تهيئة معطّلة يسهو أحد عن شرطها.
 *
 * وRTL يُفرض قبل أي رسم: `I18nManager` يحتاج إعادة تحميل ليأخذ مفعوله، فلو
 * ضُبط داخل مكوّن ظهر أول إطار بالاتجاه الخاطئ.
 */
I18nManager.allowRTL(true)
I18nManager.forceRTL(true)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // أرقام مالية: لا تُعرض قديمة بلا إعادة تحقق.
      staleTime: 15_000,
      retry: 1,
    },
  },
})

const Tabs = createBottomTabNavigator()

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PrivacyProvider>
            <StatusBar style="dark" />
            <ErrorBoundary screen="App">
              <Root />
            </ErrorBoundary>
          </PrivacyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

function Root() {
  const { status } = useAuth()
  const [anonymousScreen, setAnonymousScreen] = useState<'login' | 'register' | 'legal'>('login')

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <Body muted>لحظة…</Body>
      </View>
    )
  }

  if (status === 'anonymous') {
    if (anonymousScreen === 'legal') {
      // **بلا تسجيل** — من يُطلب منه القبول يقرأ قبل أن يملك حسابًا.
      return <LegalScreen onBack={() => setAnonymousScreen('register')} />
    }

    return anonymousScreen === 'register' ? (
      <RegisterScreen
        onBack={() => setAnonymousScreen('login')}
        onReadLegal={() => setAnonymousScreen('legal')}
      />
    ) : (
      <LoginScreen onRegister={() => setAnonymousScreen('register')} />
    )
  }

  return (
    <PolicyGate privacyScreen={<PrivacyScreen />}>
    <NavigationContainer>
      <Tabs.Navigator
        screenOptions={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: theme.color.surfaceRaised },
          headerTintColor: theme.color.brandPrimary,
          tabBarActiveTintColor: theme.color.brandPrimary,
          tabBarInactiveTintColor: theme.color.inkMuted,
          tabBarStyle: { backgroundColor: theme.color.surfaceRaised },
          // **أهداف لمس ٤٤ نقطة فأكثر** — الجوال أولًا.
          tabBarItemStyle: { minHeight: theme.touchMin },
          tabBarLabelStyle: { fontSize: theme.fontSize.caption },
          headerRight: () => <HideNumbersButton />,
        }}
      >
        <Tabs.Screen name="الرئيسية" component={DashboardScreen} />
        <Tabs.Screen name="أضف" component={AddExpenseScreen} />
        <Tabs.Screen name="العمليات" component={TransactionsScreen} />
        <Tabs.Screen name="الإحصائيات" component={StatisticsScreen} />
        <Tabs.Screen name="المزيد" component={MoreScreen} />
        <Tabs.Screen name="الخصوصية" component={PrivacyScreen} />
      </Tabs.Navigator>
    </NavigationContainer>
    </PolicyGate>
  )
}

/** **إخفاء بصري لا تشفير** — القاعدة السابعة، ويُوصف كما هو. */
function HideNumbersButton() {
  const { hidden, toggle } = usePrivacyDisplay()

  return (
    <View style={styles.headerAction}>
      <Button label={hidden ? 'إظهار' : 'إخفاء'} variant="ghost" onPress={toggle} />
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surfacePage,
  },
  headerAction: {
    paddingHorizontal: theme.space['2'],
  },
})
