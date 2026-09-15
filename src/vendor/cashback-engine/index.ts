/**
 * محرك حساب الكاش باك.
 *
 * دوال خالصة: بلا شبكة، بلا تخزين، بلا إطار، بلا متغيرات بيئة. الشرط ملزم —
 * أي خرق يحوّل استخراجه لاحقًا لحزمة مشتركة من نقل ملفات إلى إعادة كتابة
 * (docs/decisions/0003).
 */

export { CATEGORIES, MECHANISMS, computeCard, optimizeMix, perkValue, permutations } from './engine';
export { MIX_THRESHOLD, compareRanked, isMixWorthIt, rankCards } from './ranking';
export type * from './types';
