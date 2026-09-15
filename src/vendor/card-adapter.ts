/**
 * المحوّل: شكل العقد ← شكل المحرك.
 *
 * **المحرك لا يُعدَّل ليقرأ الـAPI.** الشكل الذي يتوقعه منطق مالي مُختبَر،
 * فالجسر يُكتب هنا (BUILD-BRIEF القسم ٧). أي اختلاف في النتائج بعد النقل يعني
 * خللًا في هذا الملف لا في المحرك.
 *
 * `id` في المحرك هو **`slug`** لا معرّف قاعدة البيانات: نصّ ثابت له معنى،
 * ويُستخدم فاصلَ تعادل أبجديًا في الترتيب (0005 القسم ١).
 */

import type { Card, CategoryId, Mechanism, RateConfig } from './cashback-engine';

/** عنصر `cards[]` كما يعرّفه `contracts/card-data.schema.json` */
export interface ContractCard {
  id: string;
  slug: string;
  name_ar: string;
  short_name_ar: string;
  issuer_ar: string;
  kind_ar?: string;
  cardType: string;
  network?: string;
  accentHex?: string;
  minSalary?: number | null;
  isIslamic?: boolean;
  tags?: string[];
  fee: number;
  feeNote_ar?: string | null;
  feeWaiverAnnualSpend?: number | null;
  fxFeePercent: number;
  fxUncertain?: boolean;
  totalMonthlyCap?: number | null;
  perks?: { lounges?: number; travelInsurance?: boolean; note_ar?: string };
  rates: Record<string, RateConfig>;
  notes_ar?: string[];
  termsUrl: string;
  sourceUrl?: string | null;
  effectiveFrom?: string;
  verifiedAt: string;
  mechanisms?: Mechanism[];
  aprPercent?: number | null;
  cashbackPayout?: string | null;
  cashbackMinRedemption?: number | null;
  capReset?: string | null;
  signupBonus?: SignupBonus;
  /** اسم الحقل ← سبب الغياب. وجود المفتاح إعلانٌ أننا بحثنا ولم نجد. */
  unknown?: Record<string, string>;
}

export interface ContractPayload {
  schemaVersion: string;
  generatedAt: string;
  categories: Array<{ key: string; label_ar: string; icon?: string; order: number }>;
  cards: ContractCard[];
}

export function toEngineCard(source: ContractCard): Card {
  return {
    id: source.slug,
    name: source.name_ar,
    short: source.short_name_ar,
    issuer: source.issuer_ar,
    kind: source.kind_ar,
    fee: source.fee,
    feeNote: source.feeNote_ar ?? undefined,
    feeWaiverAnnualSpend: source.feeWaiverAnnualSpend ?? null,
    fx: source.fxFeePercent,
    fxUncertain: source.fxUncertain ?? false,
    totalCap: source.totalMonthlyCap ?? null,
    accent: source.accentHex,
    perks: {
      lounges: source.perks?.lounges ?? 0,
      travelInsurance: source.perks?.travelInsurance ?? false,
      note: source.perks?.note_ar,
    },
    verified: source.verifiedAt,
    terms: source.termsUrl,
    notes: source.notes_ar ?? [],
    rates: source.rates as Partial<Record<CategoryId, RateConfig>>,
    mechanisms: source.mechanisms,
  };
}

export function toEngineCards(payload: ContractPayload): Card[] {
  return payload.cards.map(toEngineCard);
}


/**
 * بطاقة للعرض — المحرك زائد ما يحتاجه الدليل.
 *
 * **لماذا نوع منفصل لا حقول تُضاف إلى نوع المحرك:** المحرك يحسب ولا يعرض،
 * ووسمُ «طلاب» أو شبكة البطاقة لا يدخلان في أي معادلة. إضافتهما إلى نوعه
 * تُوهم القارئ بأنهما يؤثران في النتيجة، وتُصعّب استخراجه لاحقًا حزمةً مشتركة
 * كما ينصّ `docs/decisions/0003`.
 */
/**
 * مكافأة التسجيل كما تصل من الواجهة العامة.
 *
 * تصل **مؤكَّدةً وسارية أو لا تصل**: الخلفية تحذف المنتهية وغير الموثّقة من
 * الحمولة أصلًا، فلا تحتاج الواجهة أن تقرر — وقرارٌ يتكرر في مكانين يتفرّع.
 */
export interface SignupBonus {
  type: 'cashback' | 'points' | 'miles';
  value: number;
  label_ar: string;
  terms_ar?: string;
  spendRequirement?: number;
  periodDays?: number;
  validUntil?: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface DirectoryCard extends Card {
  tags: string[];
  network?: string;
  cardType: string;
  effectiveFrom?: string;
  sourceUrl?: string | null;
  fxUncertain: boolean;
  /*
   * حقول تعريفية لا تدخل أي معادلة، وقد تكون `null` بقصد: ما لم نتحقق منه
   * يُعرض «قيد التحقق…» لا فراغًا ولا تقديرًا — راجع `lib/pending.ts`.
   */
  minSalary: number | null;
  aprPercent: number | null;
  capReset: string | null;
  cashbackPayout: string | null;
  signupBonus: SignupBonus | null;
  unknown: Record<string, string>;
}

export function toDirectoryCard(source: ContractCard): DirectoryCard {
  return {
    ...toEngineCard(source),
    tags: source.tags ?? [],
    network: source.network,
    cardType: source.cardType,
    effectiveFrom: source.effectiveFrom,
    sourceUrl: source.sourceUrl ?? null,
    fxUncertain: source.fxUncertain ?? false,
    minSalary: source.minSalary ?? null,
    aprPercent: source.aprPercent ?? null,
    capReset: source.capReset ?? null,
    cashbackPayout: source.cashbackPayout ?? null,
    signupBonus: source.signupBonus ?? null,
    unknown: source.unknown ?? {},
  };
}

export function toDirectoryCards(payload: ContractPayload): DirectoryCard[] {
  return payload.cards.map(toDirectoryCard);
}
