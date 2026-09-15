/**
 * أنواع محرك الحساب.
 *
 * الشكل مطابق لما يتوقعه المحرك في `reference/cashback-calculator.jsx`. المحرك
 * لا يُعدَّل ليقرأ شكل الـAPI — المحوّل في `lib/card-adapter.ts` يجسر الفرق
 * (BUILD-BRIEF القسم ٧).
 */

/** الفئات المعيارية التسع. مفاتيحها من `contracts/categories.json` حصرًا. */
export type CategoryId =
  | 'fuel' | 'dining' | 'delivery' | 'grocery' | 'pharmacy'
  | 'travel' | 'education' | 'intl' | 'other';

export interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: string;
}

/** الصرف الشهري بالريال لكل فئة */
export type Spend = Partial<Record<CategoryId, number>>;

export interface RateConfig {
  /** كسر عشري لا نسبة مئوية: 0.11 تعني 11%. **null تعني «تحسبها آلية»**. */
  rate?: number | null;
  /** سقف الكاش باك الشهري بالريال — لا سقف الصرف */
  cap?: number | null;
  /** فئات تحمل نفس القيمة تتقاسم سقفًا واحدًا، ويجب أن تحمل نفس قيمة cap */
  capGroup?: string | null;
  excluded?: boolean;
}

export interface Perks {
  /** زيارات صالات مجانية سنويًا؛ 999 = بلا حد عمليًا */
  lounges?: number;
  travelInsurance?: boolean;
  note?: string;
}

/** المستخدم يختار فئاته شهريًا من تطبيق البنك */
export interface MonthlySelectionMechanism {
  type: 'monthly_selection';
  /** نسبة الفئات غير المختارة */
  baseRate: number;
  /** النسب مرتبة تنازليًا */
  tierRates: number[];
  /** سقف كل فئة مختارة */
  tierCap: number;
  selectable: CategoryId[];
  /** فئة تتبع أخرى في النسبة وتتقاسم سقفها، مثل { delivery: 'dining' } */
  follows?: Partial<Record<CategoryId, CategoryId>>;
}

export interface SpendTier {
  min: number;
  /** null = الشريحة العليا */
  max: number | null;
  rates: Partial<Record<CategoryId, number>>;
}

/** النسبة بإجمالي الصرف الشهري لا بالفئة */
export interface SpendTiersMechanism {
  type: 'spend_tiers';
  tiers: SpendTier[];
}

export type Mechanism = MonthlySelectionMechanism | SpendTiersMechanism;

export interface Card {
  id: string;
  name: string;
  short: string;
  issuer: string;
  kind?: string;
  /** الرسوم السنوية شاملة الضريبة */
  fee: number;
  feeNote?: string;
  feeWaiverAnnualSpend?: number | null;
  /** رسوم العمليات الدولية % */
  fx: number;
  fxUncertain?: boolean;
  /** سقف شهري إجمالي لكل الفئات مجتمعة، أو null */
  totalCap?: number | null;
  accent?: string;
  perks: Perks;
  verified: string;
  terms: string;
  notes?: string[];
  rates: Partial<Record<CategoryId, RateConfig>>;
  /** غيابها يعني نسبًا ثابتة في rates */
  mechanisms?: Mechanism[];
}

export interface ResolvedRate {
  rate: number | null;
  cap: number | null;
  capGroup: string | null;
  excluded: boolean;
}

export interface CapGroup {
  cap: number;
  raw: number;
  rows: Row[];
  active?: number;
  hit?: boolean;
}

export interface Row {
  cat: CategoryDef;
  amount: number;
  rate: number;
  excluded: boolean;
  cap: number | null;
  group: string;
  /** قبل قصّ السقوف */
  raw: number;
  /** بعد قصّ السقوف */
  earned: number;
  cappedGroup?: CapGroup;
}

export interface PerkOptions {
  on: boolean;
  visits?: number;
  visitValue?: number;
  insurance?: number;
}

export interface CardResult {
  card: Card;
  rows: Row[];
  monthly: number;
  monthlySpend: number;
  effectiveFee: number;
  feeWaived: boolean;
  fxCost: number;
  lostToCaps: number;
  lostToTotalCap: number;
  /** توزيع الفئات المختارة، بترتيب النسب تنازليًا */
  allocation: CategoryId[] | null;
  tier: SpendTier | null;
  tiers: SpendTier[] | null;
  nextTier: SpendTier | null;
}

export interface MixEntry extends CardResult {
  assigned: CategoryId[];
  finalMonthly: number;
}

export interface MixResult {
  used: MixEntry[];
  unused: Card[];
  monthly: number;
  fees: number;
  perks: number;
  netAnnual: number;
}

/** نتيجة بطاقة واحدة بعد إضافة الصافي السنوي وحساب التعادل */
export interface RankedCard extends CardResult {
  finalMonthly: number;
  perks: number;
  netAnnual: number;
  /** عدد الأشهر اللازمة لتغطية الرسوم، أو null إن كان الكاش باك صفرًا */
  breakeven: number | null;
}

/** ما تكتبه الآلية في مخرجاتها الجانبية أثناء الحساب */
export interface MechanismOutput {
  allocation?: CategoryId[];
  tier?: SpendTier;
  tiers?: SpendTier[];
  nextTier?: SpendTier | null;
}
