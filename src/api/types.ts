/**
 * أشكال الاستجابة كما تخرج من الخلفية.
 *
 * **كل مبلغ نص عشري لا رقم.** الخلفية تحسب بالهللة وتُرجع `"3825.00"`،
 * فترميزه رقمًا في أي مكان يعيد خطأ الفاصلة العائمة من الباب الخلفي.
 */

/** الشكل الموحّد لكل استجابة، بلا استثناء. */
export interface ApiEnvelope<T> {
  success: boolean
  message: string | null
  data: T
  errors: Record<string, string[]> | null
  meta?: Record<string, unknown>
}

export type Money = string

export interface User {
  id: number
  name: string
  email: string
  email_verified: boolean
  language: string
  currency: string
  salary_trigger_method: string | null
  salary_fixed_day: number | null
}

export interface SalaryCycle {
  id: number
  start_date: string
  end_date: string | null
  status: 'active' | 'closed'
  trigger_method: string
  income_amount: Money
  extra_income_amount: Money
  total_income: Money
  investment_allocated: Money
  emergency_allocated: Money
  allocation_base: Money
  spent_amount: Money
  available_balance: Money
  confirmed_at: string | null
}

export interface CyclePreview {
  previous_cycle: {
    id: number
    start_date: string
    income_amount: Money
    extra_income_amount: Money
    total_income: Money
    spent_amount: Money
    available_balance: Money
  } | null
  income_amount: Money
  investment_deduction: Money
  emergency_deduction: Money
  allocation_base: Money
  piggy_bank_contributions: Money
  budgets: { id: number; name: string; current_amount: Money; next_amount: Money }[]
  projected_surplus: Money
}

export interface Budget {
  id: number
  name: string
  icon: string | null
  color: string | null
  allocation_type: 'fixed' | 'percentage'
  allocation_value: Money
  computed_amount: Money
  salary_cycle_id: number | null
  sort_order: number
  is_archived: boolean
  accepts_new_expenses: boolean
}

export interface AllocationStatus {
  base: Money
  allocated: Money
  over_by: Money
  exceeds: boolean
}

export interface PiggyBank {
  id: number
  name: string
  icon: string | null
  color: string | null
  monthly_contribution: Money
  current_balance: Money
  target_amount: Money | null
  target_date: string | null
  sort_order: number
  can_be_deleted: boolean
}

export interface FixedCommitment {
  id: number
  name: string
  amount: Money
  due_day: number
  due_day_this_month: number
  is_paid_current_cycle: boolean
  sort_order: number
}

export interface AutoAllocation {
  type: 'investment' | 'emergency'
  method: 'percentage' | 'fixed'
  value: Money
  current_balance: Money
  surplus_share_percentage: Money
}

export type TransactionType =
  | 'expense'
  | 'piggybank_transfer'
  | 'piggybank_withdrawal'
  | 'investment_allocation'
  | 'emergency_allocation'

export interface Transaction {
  id: number
  type: TransactionType
  amount: Money
  is_outgoing: boolean
  spent_at: string
  merchant_name: string | null
  items: { name: string; price?: Money }[] | null
  neighborhood: string | null
  category_type: 'budget' | 'commitment' | 'piggybank' | null
  category_id: number | null
  salary_cycle_id: number | null
  user_card_id: number | null
  input_method: 'manual' | 'bank_sms' | 'receipt_photo'
  was_edited_by_user: boolean
  is_auto_generated: boolean
  auto_reason: string | null
  tags?: { id: number; name: string; color: string | null }[]
  created_at: string
}

export interface UserCard {
  id: number
  name: string
  bank_name: string
  last_four: string | null
  nickname: string | null
}

export interface Tag {
  id: number
  name: string
  color: string | null
  icon: string | null
  scope: 'budget' | 'transaction' | 'both'
  usage_count: number
  sort_order: number
}

export interface Debt {
  id: number
  type: 'owed_to_me' | 'owed_by_me'
  counterparty_name: string
  counterparty_contact_id: string | null
  original_amount: Money
  note: string | null
  paid_amount: Money
  remaining_amount: Money
  status: 'open' | 'settled'
  payments?: DebtPayment[]
}

export interface DebtPayment {
  id: number
  amount: Money
  paid_at: string
  note: string | null
}

export interface Statistics {
  period: { type: string; from: string; to: string; salary_cycle_id: number | null }
  income: { salary: Money; extra: Money; total: Money }
  spending: {
    total: Money
    transaction_count: number
    by_budget: {
      id: number
      name: string
      is_archived: boolean
      allocated: Money
      spent: Money
      remaining: Money
      overspent_by: Money
    }[]
    by_commitment: { id: number; name: string; amount: Money; paid: boolean; spent: Money }[]
    by_piggy_bank: { id: number; name: string; current_balance: Money; spent: Money }[]
    uncategorised: Money
    /** `overlaps` تعني أن عملية تحمل وسمين فحُسبت في كليهما. */
    by_tag: { overlaps: boolean; rows: { id: number; name: string; spent: Money }[] }
  }
  automatic: { investment: Money; emergency: Money; piggy_banks: Money }
  cycle: { available_balance: Money; allocation_base: Money } | null
}

export interface AuditEntry {
  id: number
  action: 'created' | 'updated' | 'deleted' | 'restored'
  entity: string
  entity_id: number
  changed_fields: string[]
  changes: Record<string, unknown>
  is_impersonated: boolean
  created_at: string
}

/**
 * طلب تحليل رسالة أو فاتورة.
 *
 * **`result` مسودة لا عملية**: `requires_review` صحيح دائمًا، والحفظ لا يتم
 * إلا بتأكيد المستخدم في فورم المراجعة — القسم ٥.٥.
 */
export interface ParseRequest {
  id: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  input_method: 'bank_sms' | 'receipt_photo'
  result: {
    amount: Money | null
    merchant_name: string | null
    spent_at: string | null
    card_last_four: string | null
    currency: string | null
    confidence: number
    provider: string | null
    requires_review: true
  } | null
  provider: string | null
  failure_reason: string | null
  completed_at: string | null
}

export interface CategorySuggestion {
  category_type: 'budget' | 'commitment' | 'piggybank'
  category_id: number
  confidence: number
}

export interface ConsentState {
  granted: boolean
  version: string
  granted_at: string | null
}

export type ConsentStatusMap = Record<string, ConsentState>

export interface EgressEvent {
  purpose: string
  destination: string
  occurred_at: string
}

/**
 * لوحة الخصوصية.
 *
 * `data_egress.ever` تُقال صراحةً: الصمت في هذا الموضع يُقرأ شكًّا.
 */
export interface PrivacyDashboard {
  consents: ConsentStatusMap
  data_egress: {
    ever: boolean
    last: EgressEvent | null
    per_purpose: Record<string, EgressEvent>
  }
  backup: { password_set: boolean; last_sent_at: string | null }
  deletion: { requested_at: string | null; scheduled_for: string | null }
  activity: {
    action: string
    entity: string
    fields: string[]
    is_impersonated: boolean
    at: string
  }[]
}

export interface ImpersonationRequest {
  id: number
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'completed'
  reason: string
  requested_by: string | null
  requested_at: string
  response_deadline: string
  responded_at: string | null
  session_started_at: string | null
  session_ended_at: string | null
  can_be_entered: boolean
}
