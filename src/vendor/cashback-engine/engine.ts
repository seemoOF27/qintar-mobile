/**
 * محرك حساب الكاش باك — منقول حرفيًا من `reference/cashback-calculator.jsx`.
 *
 * **منطق مالي مُختبَر. يُنقل كما هو ويُضاف له تعريف أنواع فقط.**
 * لا يُعاد تصميمه ولا «يُحسَّن». أي تغيير يغيّر ناتج حساب هو تغيير كاسر ولو كان
 * إصلاح خطأ (docs/decisions/0003).
 *
 * وحدة معزولة: **لا تستورد شيئًا من إطار العمل ولا تلمس شبكة ولا تخزينًا**.
 * الشرط ملزم لأن الاستخراج لاحقًا لحزمة مشتركة يجب أن يبقى نقل ملفات لا إعادة
 * كتابة.
 */

import type {
  CapGroup, Card, CategoryDef, CategoryId, MechanismOutput, Mechanism,
  MixEntry, MixResult, MonthlySelectionMechanism, PerkOptions, ResolvedRate,
  Row, CardResult, SpendTiersMechanism, Spend,
} from './types';

/**
 * الفئات المعيارية التسع.
 *
 * ثابتة لا بيانات وقت تشغيل: العقد يمنع تغيير مفتاح موجود، وإضافة فئة تعني
 * نسخة رئيسية وهجرة مخططة. يربطها بالعقد اختبارٌ يقارنها بـ
 * `contracts/categories.json` حرفيًا.
 */
export const CATEGORIES: CategoryDef[] = [
  { id: 'fuel', label: 'محطات الوقود', icon: 'Fuel' },
  { id: 'dining', label: 'المطاعم والمقاهي', icon: 'UtensilsCrossed' },
  { id: 'delivery', label: 'تطبيقات التوصيل', icon: 'Bike' },
  { id: 'grocery', label: 'السوبرماركت والتموينات', icon: 'ShoppingCart' },
  { id: 'pharmacy', label: 'الصيدليات والرعاية الطبية', icon: 'Pill' },
  { id: 'travel', label: 'السفر والفنادق', icon: 'Plane' },
  { id: 'education', label: 'التعليم', icon: 'GraduationCap' },
  { id: 'intl', label: 'المشتريات الدولية', icon: 'Globe' },
  { id: 'other', label: 'مشتريات أخرى محلية', icon: 'Wallet' },
];

export function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

/* ============================================================================
   الآليات — كل بطاقة تعلن ما ينطبق عليها، والمحرك يطبّقها بالترتيب.
   إضافة آلية جديدة = دالة هنا + وصفها في العقد. لا تُمَس بقية المحرك.
   ========================================================================== */

const permCache = new Map<string, CategoryId[][]>();
function permsOf(list: CategoryId[]): CategoryId[][] {
  const key = list.join(',');
  if (!permCache.has(key)) permCache.set(key, permutations(list));
  return permCache.get(key)!;
}

type MechanismFn = (
  m: never,
  rates: Record<CategoryId, ResolvedRate>,
  spend: Spend,
  out: MechanismOutput,
) => void;

export const MECHANISMS: Record<string, MechanismFn> = {
  /* اختيار شهري — المستخدم يوزّع نسبًا ثابتة على فئات يختارها بنفسه (الفرنسي).
     نجرّب كل التوزيعات الممكنة ونختار الأعلى عائدًا لصرفه هو. */
  monthly_selection(m: MonthlySelectionMechanism, rates, spend, out) {
    const follows = m.follows || {};
    const groupSpend: Partial<Record<CategoryId, number>> = {};
    m.selectable.forEach((c) => (groupSpend[c] = spend[c] || 0));
    for (const from in follows) {
      const to = follows[from as CategoryId]!;
      groupSpend[to] = (groupSpend[to] || 0) + (spend[from as CategoryId] || 0);
    }

    let best: { total: number; perm: CategoryId[] } | null = null;
    for (const perm of permsOf(m.selectable)) {
      let total = 0;
      for (let i = 0; i < perm.length; i++) {
        total += Math.min((groupSpend[perm[i]] || 0) * m.tierRates[i], m.tierCap);
      }
      if (!best || total > best.total) best = { total, perm };
    }

    // النسبة الأساسية لكل فئة لم تُحدَّد بعد
    CATEGORIES.forEach((c) => {
      if (rates[c.id].rate == null) rates[c.id].rate = m.baseRate;
    });
    best!.perm.forEach((cat, i) => {
      rates[cat] = { ...rates[cat], rate: m.tierRates[i], cap: m.tierCap, capGroup: cat };
    });
    // فئة تتبع أخرى في النسبة وتتقاسم سقفها
    for (const from in follows) {
      const to = follows[from as CategoryId]!;
      rates[from as CategoryId] = {
        ...rates[from as CategoryId],
        rate: rates[to].rate,
        cap: m.tierCap,
        capGroup: to,
      };
    }
    out.allocation = best!.perm;
  },

  /* شرائح الصرف — النسبة تتحدد بإجمالي الصرف الشهري لا بالفئة (الأول).
     في وضع عدة بطاقات تُحسب بالصرف الموجَّه لهذي البطاقة، لأن البنك لا يرى غيره. */
  spend_tiers(m: SpendTiersMechanism, rates, spend, out) {
    const total = CATEGORIES.reduce((s, c) => s + (spend[c.id] || 0), 0);
    const tier = m.tiers.find((t) => total >= t.min && (t.max == null || total <= t.max));
    if (!tier) return;
    for (const key in tier.rates) {
      const id = key as CategoryId;
      rates[id] = { ...rates[id], rate: tier.rates[id]! };
    }
    out.tier = tier;
    out.tiers = m.tiers;
    out.nextTier = m.tiers.find((t) => t.min > total) || null;
  },
} as Record<string, MechanismFn>;

export function computeCard(card: Card, spend: Spend): CardResult {
  // نسخة قابلة للتعديل؛ rate = null تعني «تحسبها آلية»
  const rates = {} as Record<CategoryId, ResolvedRate>;
  CATEGORIES.forEach((c) => {
    const src = (card.rates && card.rates[c.id]) || {};
    rates[c.id] = {
      rate: src.rate == null ? null : src.rate,
      cap: src.cap == null ? null : src.cap,
      capGroup: src.capGroup || null,
      excluded: !!src.excluded,
    };
  });

  const out: MechanismOutput = {};
  for (const m of card.mechanisms || []) {
    const fn = MECHANISMS[(m as Mechanism).type];
    if (fn) fn(m as never, rates, spend, out);
  }

  // أي نسبة بقيت بلا آلية تحسبها = صفر
  CATEGORIES.forEach((c) => {
    if (rates[c.id].rate == null) rates[c.id].rate = 0;
  });

  const rows: Row[] = CATEGORIES.map((cat) => {
    const conf = rates[cat.id] || { rate: 0, cap: null };
    const amount = spend[cat.id] || 0;
    return {
      cat, amount, rate: conf.rate!, excluded: !!conf.excluded, cap: conf.cap,
      group: conf.capGroup || cat.id, raw: amount * conf.rate!, earned: amount * conf.rate!,
    };
  });

  const groups: Record<string, CapGroup> = {};
  rows.forEach((r) => {
    if (r.cap == null) return;
    groups[r.group] = groups[r.group] || { cap: r.cap, raw: 0, rows: [] };
    groups[r.group].raw += r.raw;
    groups[r.group].rows.push(r);
  });
  let lostToCaps = 0;
  Object.values(groups).forEach((g) => {
    g.active = g.rows.filter((r) => r.rate > 0).length;
    g.hit = g.raw > g.cap + 1e-9;
    if (g.hit) {
      const f = g.cap / g.raw;
      g.rows.forEach((r) => { r.earned = r.raw * f; r.cappedGroup = g; });
      lostToCaps += g.raw - g.cap;
    } else {
      g.rows.forEach((r) => (r.cappedGroup = g));
    }
  });

  let monthly = rows.reduce((s, r) => s + r.earned, 0);
  let lostToTotalCap = 0;
  if (card.totalCap != null && monthly > card.totalCap) {
    const f = card.totalCap / monthly;
    rows.forEach((r) => (r.earned *= f));
    lostToTotalCap = monthly - card.totalCap;
    monthly = card.totalCap;
  }

  const monthlySpend = CATEGORIES.reduce((s, c) => s + (spend[c.id] || 0), 0);
  const feeWaived =
    card.feeWaiverAnnualSpend != null && monthlySpend * 12 >= card.feeWaiverAnnualSpend;
  return {
    card, rows, monthly, monthlySpend,
    effectiveFee: feeWaived ? 0 : card.fee,
    feeWaived,
    fxCost: ((spend.intl || 0) * card.fx) / 100,
    lostToCaps, lostToTotalCap,
    allocation: out.allocation || null,
    tier: out.tier || null,
    tiers: out.tiers || null,
    nextTier: out.nextTier || null,
  };
}

/* ---------------------- قيمة المزايا غير النقدية ---------------------- */
export function perkValue(cardsUsed: Card[], opts: PerkOptions): number {
  if (!opts.on || !cardsUsed.length) return 0;
  const maxLounge = Math.max(0, ...cardsUsed.map((c) => c.perks.lounges || 0));
  const visits = Math.min(opts.visits || 0, maxLounge);
  const ins = cardsUsed.some((c) => c.perks.travelInsurance) ? opts.insurance || 0 : 0;
  return visits * (opts.visitValue || 0) + ins;
}

/* ---------------------- مُحسِّن الخليط (عدة بطاقات) ---------------------- */
export function optimizeMix(
  cards: Card[],
  spend: Spend,
  fxOn: boolean,
  perkOpts: PerkOptions,
): MixResult | null {
  const cats = CATEGORIES.filter((c) => (spend[c.id] || 0) > 0);
  if (!cards.length || !cats.length) return null;

  type Assign = Partial<Record<CategoryId, string>>;

  const cache = new Map<string, CardResult>();
  const run = (card: Card, sub: Spend) => {
    const key = card.id + '|' + CATEGORIES.map((c) => sub[c.id] || 0).join(',');
    let v = cache.get(key);
    if (!v) { v = computeCard(card, sub); cache.set(key, v); }
    return v;
  };
  const subFor = (assign: Assign, cardId: string): Spend => {
    const o: Spend = {};
    CATEGORIES.forEach((c) => (o[c.id] = assign[c.id] === cardId ? spend[c.id] || 0 : 0));
    return o;
  };
  const usedOf = (assign: Assign, pool: Card[]) =>
    pool.filter((c) => cats.some((cat) => assign[cat.id] === c.id));

  const cashback = (assign: Assign, pool: Card[]) => {
    let m = 0;
    for (const c of pool) {
      const sub = subFor(assign, c.id);
      if (!CATEGORIES.some((x) => (sub[x.id] || 0) > 0)) continue;
      const r = run(c, sub);
      m += fxOn ? r.monthly - r.fxCost : r.monthly;
    }
    return m;
  };
  const netAnnual = (assign: Assign, pool: Card[]) => {
    let m = 0, fees = 0;
    for (const c of pool) {
      const sub = subFor(assign, c.id);
      if (!CATEGORIES.some((x) => (sub[x.id] || 0) > 0)) continue;
      const r = run(c, sub);
      m += fxOn ? r.monthly - r.fxCost : r.monthly;
      fees += r.effectiveFee;
    }
    return m * 12 - fees + perkValue(usedOf(assign, pool).map((c) => c), perkOpts);
  };

  // بحث محلي: ينقل فئة واحدة في المرة، من نقطة بداية معطاة
  const localSearch = (assign: Assign, pool: Card[]) => {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const cat of cats) {
        const cur = assign[cat.id];
        let bestId = cur, bestV = cashback(assign, pool);
        for (const c of pool) {
          if (c.id === cur) continue;
          assign[cat.id] = c.id;
          const v = cashback(assign, pool);
          if (v > bestV + 1e-9) { bestV = v; bestId = c.id; }
        }
        assign[cat.id] = bestId;
        if (bestId !== cur) moved = true;
      }
      if (!moved) break;
    }
    return assign;
  };

  const greedy = (pool: Card[]) => {
    const assign: Assign = {};
    const order = [...cats].sort((a, b) => (spend[b.id] || 0) - (spend[a.id] || 0));
    for (const cat of order) {
      let bestId = pool[0].id, bestV = -Infinity;
      for (const c of pool) {
        assign[cat.id] = c.id;
        const v = cashback(assign, pool);
        if (v > bestV + 1e-9) { bestV = v; bestId = c.id; }
      }
      assign[cat.id] = bestId;
    }
    return assign;
  };

  /* بدايات متعددة.
     الجشِع وحده يعمى عن بطاقات شرائح الصرف: نقل فئة واحدة إليها لا يكفي
     لعبور عتبة الشريحة، فيبدو عائدها الحدّي ضعيفًا وتُهمَل — بينما تجميع
     ثلاث فئات عليها معًا يرفعها من ٣٪ إلى ١٠٪. لذلك نضيف نقطة بداية
     «كل الفئات على هذي البطاقة» لكل بطاقة، ثم نبحث محليًا من كل بداية. */
  const build = (pool: Card[]) => {
    const starts = [greedy(pool)];
    for (const c of pool) {
      const a: Assign = {};
      cats.forEach((cat) => (a[cat.id] = c.id));
      starts.push(a);
    }
    let best: { v: number; a: Assign } | null = null;
    for (const st of starts) {
      const a = localSearch({ ...st }, pool);
      const v = cashback(a, pool);
      if (!best || v > best.v + 1e-9) best = { v, a };
    }
    return best!.a;
  };

  let pool = [...cards];
  let assign = build(pool);
  let net = netAnnual(assign, pool);

  // إسقاط أي بطاقة رسومها أكبر من إضافتها
  let go = true;
  while (go && pool.length > 1) {
    go = false;
    let best: { pool: Card[]; assign: Assign; net: number } | null = null;
    for (const c of usedOf(assign, pool)) {
      const np = pool.filter((x) => x.id !== c.id);
      if (!np.length) continue;
      const na = build(np);
      const nn = netAnnual(na, np);
      if (nn > net + 1e-6 && (!best || nn > best.net)) best = { pool: np, assign: na, net: nn };
    }
    if (best) { pool = best.pool; assign = best.assign; net = best.net; go = true; }
  }

  const used: MixEntry[] = usedOf(assign, pool).map((c) => {
    const sub = subFor(assign, c.id);
    const r = run(c, sub);
    return {
      ...r,
      assigned: cats.filter((cat) => assign[cat.id] === c.id).map((cat) => cat.id),
      finalMonthly: fxOn ? r.monthly - r.fxCost : r.monthly,
    };
  }).sort((a, b) => b.finalMonthly - a.finalMonthly);

  return {
    used,
    unused: cards.filter((c) => !used.some((u) => u.card.id === c.id)),
    monthly: used.reduce((s, u) => s + u.finalMonthly, 0),
    fees: used.reduce((s, u) => s + u.effectiveFee, 0),
    perks: perkValue(used.map((u) => u.card), perkOpts),
    netAnnual: net,
  };
}
