/**
 * الترتيب وعتبة الخليط — قواعد عمل، مكانها المحرك لا مكوّن الواجهة.
 *
 * هذا الملف يحمل **الانحرافين الوحيدين** عن النقل الحرفي، وكلاهما منصوص عليه
 * في `docs/decisions/0005`:
 *
 * ١ · `MIX_THRESHOLD` كانت في طبقة العرض. هي قاعدة عمل تقرر ما يُوصى به
 *     للمستخدم ولها اختبار قبول، فمكانها هنا (القسم ٢).
 *
 * ٢ · الترتيب في المرجع بالصافي السنوي وحده **بلا فاصل تعادل**. ترتيب
 *     JavaScript مستقر، فبطاقتان متساويتان تبقيان بترتيب وصولهما من الخادم —
 *     وهو `sort_order`، حقل يحرّره محرّر. ذلك خرق للقاعدة الأولى: الترتيب لا
 *     يُشترى. الفاصل المحسوم: الرسوم الأقل ← الكاش باك الشهري الأعلى ←
 *     `slug` أبجديًا (القسم ١).
 *
 *     ويخدم غرضًا ثانيًا: ترتيب المتساويات غير مضمون ولا متطابق بين MySQL
 *     وPostgres، فالفاصل الحتمي شرط قابلية النقل أيضًا (0004 البند ٣).
 */

import { computeCard, perkValue } from './engine';
import type { Card, MixResult, PerkOptions, RankedCard, Spend } from './types';

/** أقل فرق سنوي يجعل تعدد البطاقات يستحق العناء */
export const MIX_THRESHOLD = 120;

/** هامش المقارنة بين مبالغ — المال لا يُقارن بمساواة تامة */
const EPSILON = 1e-9;

/**
 * ترتيب البطاقات بالصافي السنوي، بفاصل تعادل حتمي.
 *
 * **معرّف البطاقة ليس فاصلًا مقبولًا**: ترقيم تلقائي بترتيب الإنشاء، متأثر
 * بالإدارة، ولا يعني شيئًا للمستخدم. أما الرسوم الأقل فمعنى حقيقي — إذا تساوى
 * صافيان، الأقل رسومًا أقل مخاطرة.
 */
export function rankCards(
  cards: Card[],
  spend: Spend,
  fxOn: boolean,
  perkOpts: PerkOptions,
): RankedCard[] {
  const results = cards.map((card) => {
    const r = computeCard(card, spend);
    const finalMonthly = fxOn ? r.monthly - r.fxCost : r.monthly;
    const perks = perkValue([r.card], perkOpts);

    return {
      ...r,
      finalMonthly,
      perks,
      netAnnual: finalMonthly * 12 - r.effectiveFee + perks,
      breakeven: r.effectiveFee === 0 ? 0
        : finalMonthly > 0 ? Math.ceil(r.effectiveFee / finalMonthly) : null,
    } as RankedCard;
  });

  return results.sort(compareRanked);
}

/** الترتيب: الصافي الأعلى ← الرسوم الأقل ← الكاش باك الشهري الأعلى ← slug أبجديًا */
export function compareRanked(a: RankedCard, b: RankedCard): number {
  if (Math.abs(a.netAnnual - b.netAnnual) > EPSILON) {
    return b.netAnnual - a.netAnnual;
  }
  if (Math.abs(a.effectiveFee - b.effectiveFee) > EPSILON) {
    return a.effectiveFee - b.effectiveFee;
  }
  if (Math.abs(a.finalMonthly - b.finalMonthly) > EPSILON) {
    return b.finalMonthly - a.finalMonthly;
  }
  return a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0;
}

/**
 * هل يستحق الخليط أن يُوصى به؟
 *
 * لو الفرق تافه، الواجهة تقول صراحة إن بطاقة واحدة تكفي. حمل بطاقتين وتذكّر
 * أي فئة على أيّها تكلفة حقيقية لا تظهر في الأرقام.
 */
export function isMixWorthIt(mix: MixResult | null, best: RankedCard | undefined): boolean {
  if (!mix || !best) return false;

  return mix.netAnnual - best.netAnnual >= MIX_THRESHOLD && mix.used.length > 1;
}
