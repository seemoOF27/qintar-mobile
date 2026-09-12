import { Component, type ErrorInfo, type ReactNode } from 'react'
import { View } from 'react-native'
import { api } from '@/api/client'
import { Body, Button, Card, Title } from '@/components/ui'
import { theme } from '@/theme'

/**
 * حدّ الأعطال.
 *
 * **إلى خادمنا وحده، وحقلان لا غير**: صنف الخطأ واسم الشاشة. لا رسالة، ولا
 * أثر مكدس، ولا شجرة مكوّنات — كلها قد تحمل مبلغًا أو اسم تاجر.
 *
 * ولا حزمة مراقبة في المشروع أصلًا — القاعدة الرابعة في `CLAUDE.md`: «عدم
 * التحميل أقوى من التهيئة المعطّلة». والخادم هو من يقرر إن كان التقرير
 * يغادر، ببوابة `error_monitoring`. **بوابة واحدة لثلاث طبقات.**
 */
interface Props {
  children: ReactNode
  screen: string
}

export class ErrorBoundary extends Component<Props, { broken: boolean }> {
  state = { broken: false }

  static getDerivedStateFromError() {
    return { broken: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    void api
      .post('/client-errors', { name: error.name, screen: this.props.screen })
      .catch(() => undefined)
  }

  render(): ReactNode {
    if (!this.state.broken) return this.props.children

    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.space['5'], gap: theme.space['3'], backgroundColor: theme.color.surfacePage }}>
        <Card>
          <Title>انكسر شي في الشاشة</Title>
          <Body muted>بياناتك ما تأثرت. ارجع وحاول من جديد.</Body>
          <Button label="حاول مرة ثانية" onPress={() => this.setState({ broken: false })} />
        </Card>
      </View>
    )
  }
}
