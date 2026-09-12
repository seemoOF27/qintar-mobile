import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import { theme } from '@/theme'

/**
 * المكوّنات الأساسية.
 *
 * **لا Hex في أي مكان** — كل لون من `theme` المولَّد من
 * `shared/design-tokens.json`، ويحرس ذلك اختبار. القاعدة الثانية في
 * `CLAUDE.md`: تغيير الهوية تعديل ملف واحد لا بحث واستبدال.
 *
 * **وأهداف اللمس ٤٤ نقطة فأكثر، والخط ١٦ فأكثر في كل حقل.** الجوال أولًا،
 * وحقلٌ أصغر من ذلك يكبّره iOS تلقائيًا فتقفز الشاشة عند التركيز.
 */

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={muted ? styles.bodyMuted : styles.body}>{children}</Text>
}

export function Caption({ children }: { children: ReactNode }) {
  return <Text style={styles.caption}>{children}</Text>
}

export type NoticeTone = 'info' | 'positive' | 'warning' | 'danger'

const TONE_COLOR: Record<NoticeTone, string> = {
  info: theme.color.stateInfo,
  positive: theme.color.statePositive,
  warning: theme.color.stateWarning,
  danger: theme.color.stateDanger,
}

export function Notice({ tone = 'info', children }: { tone?: NoticeTone; children: ReactNode }) {
  return (
    <View style={[styles.notice, { borderColor: TONE_COLOR[tone] }]}>
      <Text style={[styles.body, { color: TONE_COLOR[tone] }]}>{children}</Text>
    </View>
  )
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  busy?: boolean
}) {
  const blocked = disabled || busy

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy }}
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'ghost' && styles.buttonGhost,
        blocked && styles.buttonBlocked,
        pressed && styles.buttonPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'ghost' ? theme.color.inkBase : theme.color.inkInverse} />
      ) : (
        <Text style={variant === 'ghost' ? styles.buttonGhostLabel : styles.buttonLabel}>{label}</Text>
      )}
    </Pressable>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint !== undefined && error === undefined && <Caption>{hint}</Caption>}
      {error !== undefined && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.color.inkMuted}
      {...props}
      style={[styles.input, props.style]}
    />
  )
}

/**
 * حقل مبلغ.
 *
 * `decimal-pad` لا `numeric`: الثاني يعرض لوحة فيها رموز لا معنى لها في
 * مبلغ. والقيمة تبقى **نصًّا** من الحقل إلى الخادم بلا مرور على `number`.
 */
export function MoneyInput(props: TextInputProps) {
  return <Input keyboardType="decimal-pad" inputMode="decimal" placeholder="0.00" {...props} />
}

export function EmptyState({ title }: { title: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.bodyMuted}>{title}</Text>
    </View>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>
}

export function Divider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.surfacePage,
  },
  screenContent: {
    padding: theme.space['4'],
    gap: theme.space['4'],
    paddingBottom: theme.space['7'],
  },
  card: {
    backgroundColor: theme.color.surfaceRaised,
    borderColor: theme.color.surfaceBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.md,
    padding: theme.space['4'],
    gap: theme.space['2'],
  },
  title: {
    fontSize: theme.fontSize.title,
    fontWeight: '600',
    color: theme.color.inkStrong,
    textAlign: 'right',
  },
  body: {
    fontSize: theme.fontSize.body,
    color: theme.color.inkBase,
    textAlign: 'right',
  },
  bodyMuted: {
    fontSize: theme.fontSize.body,
    color: theme.color.inkMuted,
    textAlign: 'right',
  },
  caption: {
    fontSize: theme.fontSize.caption,
    color: theme.color.inkMuted,
    textAlign: 'right',
  },
  notice: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.space['3'],
    backgroundColor: theme.color.surfaceRaised,
    gap: theme.space['2'],
  },
  button: {
    minHeight: theme.touchMin,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space['4'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: theme.color.brandPrimary },
  buttonDanger: { backgroundColor: theme.color.stateDanger },
  buttonGhost: {
    backgroundColor: theme.color.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.surfaceBorder,
  },
  buttonBlocked: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: {
    color: theme.color.inkInverse,
    fontSize: theme.fontSize.body,
    fontWeight: '600',
  },
  buttonGhostLabel: {
    color: theme.color.inkBase,
    fontSize: theme.fontSize.body,
  },
  field: { gap: theme.space['1'] },
  label: {
    fontSize: theme.fontSize.caption,
    color: theme.color.inkMuted,
    textAlign: 'right',
  },
  input: {
    minHeight: theme.touchMin,
    // **لا أقل من ١٦**: أصغر منه يكبّره iOS تلقائيًا عند التركيز.
    fontSize: theme.fontSize.body,
    color: theme.color.inkStrong,
    backgroundColor: theme.color.surfaceRaised,
    borderColor: theme.color.surfaceBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space['3'],
    textAlign: 'right',
  },
  error: {
    fontSize: theme.fontSize.caption,
    color: theme.color.stateDanger,
    textAlign: 'right',
  },
  empty: {
    padding: theme.space['5'],
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space['2'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.color.surfaceBorder,
  },
})
