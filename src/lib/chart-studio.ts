/**
 * استوديو الرسوم: أنواع الإعدادات + توليد SQL محلي + أدوات التنسيق.
 * كل شيء يُنفَّذ داخل المتصفح عبر DuckDB-WASM — لا يغادر أي صف جهاز المستخدم.
 */
import { quoteIdent, type TableInfo } from "@/lib/duckdb-service";
import { isNumericType } from "@/lib/profile";

export type ChartKind =
  | "bar"
  | "horizontalBar"
  | "stacked"
  | "line"
  | "area"
  | "pie"
  | "combo"
  | "funnel"
  | "waterfall"
  | "treemap"
  | "radar"
  | "histogram"
  | "boxplot"
  | "scatter"
  | "heatmap";
export type AggFn = "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
export type SortMode = "value_desc" | "value_asc" | "label_asc";
export type LegendPos = "top" | "bottom" | "hidden";
export type Align = "right" | "center" | "left";

export type TimeBucket = "auto" | "day" | "week" | "month" | "year";

export interface ChartKindRecommendation {
  kind: "bar" | "line" | "pie";
  label: string;
  reason: string;
  sort?: SortMode;
}

/** Suggest a suitable chart for the selected dimension without mutating user settings. */
export function recommendChartKind(
  info: Pick<TableInfo, "schema">,
  xColumn: string,
  points: ChartPoint[] = [],
  completeCategories = false,
): ChartKindRecommendation {
  if (isTemporalColumn(info, xColumn)) {
    if (points.length === 1) {
      return {
        kind: "bar",
        label: "أعمدة",
        reason: "توجد نقطة زمنية واحدة فقط؛ الأعمدة أوضح من خط لا يُظهر اتجاهاً بعد.",
      };
    }
    return {
      kind: "line",
      label: "خطي",
      reason: "المحور الأفقي زمني؛ الرسم الخطي يوضح الاتجاه، وسيُرتّب التواريخ تصاعدياً.",
      sort: "label_asc",
    };
  }

  const total = points.reduce((sum, point) => sum + point.value, 0);
  if (
    completeCategories &&
    points.length >= 2 &&
    points.length <= 6 &&
    points.every((point) => point.value >= 0) &&
    total > 0
  ) {
    return {
      kind: "pie",
      label: "دائري",
      reason:
        "الفئات مكتملة وعددها قليل وقيمها غير سالبة؛ يمكن مقارنة حصصها دون إخفاء فئات بسبب حدّ العرض.",
    };
  }

  if (points.some((point) => point.value < 0)) {
    return {
      kind: "bar",
      label: "أعمدة",
      reason:
        "توجد قيم سالبة؛ الأعمدة تعرض اتجاهها وحجمها بدقة، بينما الرسم الدائري لا يمثلها بصورة صحيحة.",
    };
  }
  if (points.length > 6 || !completeCategories) {
    return {
      kind: "bar",
      label: "أعمدة",
      reason:
        "المقارنة بالأعمدة أوضح من الدائري عند كثرة الفئات أو عندما لا تكون جميع الفئات معروضة.",
    };
  }

  return {
    kind: "bar",
    label: "أعمدة",
    reason: "المحور الأفقي فئوي أو غير زمني؛ الأعمدة تسهّل مقارنة القيم بين الفئات.",
  };
}

/** خيارات التجميع الزمني في الواجهة (none = القيم الأصلية بلا تجميع). */
export const TIME_BUCKETS: { id: TimeBucket | "none"; label: string }[] = [
  { id: "none", label: "بلا تجميع" },
  { id: "auto", label: "تلقائي" },
  { id: "day", label: "يومي" },
  { id: "week", label: "أسبوعي" },
  { id: "month", label: "شهري" },
  { id: "year", label: "سنوي" },
];

/** هل العمود زمني فعلياً (DATE/TIMESTAMP)؟ التجميع الزمني يعمل لهذه الأنواع فقط. */
export function isTemporalColumn(info: Pick<TableInfo, "schema">, name: string): boolean {
  return /^(DATE|TIMESTAMP)/i.test(info.schema.find((c) => c.name === name)?.type ?? "");
}

export interface ChartConfig {
  kind: ChartKind;
  x: string;
  y: string;
  agg: AggFn;
  sort: SortMode;
  limit: number; // 0 = الكل
  palette: string;
  colors: string[];
  gradient: boolean;
  radius: number;
  curve: "monotone" | "linear";
  title: string;
  subtitle: string;
  align: Align;
  prefix: string;
  suffix: string;
  compact: boolean;
  dataLabels: boolean;
  grid: boolean;
  legend: LegendPos;
  xAngle: 0 | -45 | -90;
  /** "auto" = تجميع زمني يُختار من مدى التواريخ (للأعمدة الزمنية فقط). */
  bucket?: TimeBucket | undefined;
  /** صيغة strptime عندما يكون عمود x نصاً يمثل تاريخاً (مثل "%m/%d/%Y"). */
  dateFormat?: string | undefined;
  /** بُعد تقسيم السلاسل (عمود فئوي ثانٍ)؛ يُقصّ إلى أعلى SERIES_CAP سلاسل. */
  series?: string | undefined;
  /** مقياس ثانٍ لرسم المركّب على محور ثانوي (يُجمَّع بنفس دالة التجميع). */
  y2?: string | undefined;
  /** تطبيع الأعمدة المكدسة إلى 100% لكل فئة. */
  stackPercent?: boolean | undefined;
}

/** أقصى عدد سلاسل مرسومة؛ الباقي يُستبعد مع إظهار ذلك للمستخدم. */
export const SERIES_CAP = 8;

/** الأنواع التي تدعم بُعد تقسيم السلاسل. */
export const SERIES_KINDS: ChartKind[] = [
  "bar",
  "horizontalBar",
  "line",
  "area",
  "stacked",
  "heatmap",
];

/** هل يُطبَّق تقسيم السلاسل فعلاً لهذا الإعداد؟ */
export function activeSeries(
  info: Pick<TableInfo, "schema">,
  cfg: Pick<ChartConfig, "kind" | "x" | "series">,
): string | null {
  if (!cfg.series || cfg.series === cfg.x || !SERIES_KINDS.includes(cfg.kind)) return null;
  return info.schema.some((c) => c.name === cfg.series) ? cfg.series : null;
}

/** المقياس الثاني الفعّال (مركّب + عمود رقمي موجود وليس نفس Y). */
export function activeY2(
  info: Pick<TableInfo, "schema">,
  cfg: Pick<ChartConfig, "kind" | "y" | "y2" | "agg">,
): string | null {
  // مع COUNT يكون المقياسان متطابقين، فلا معنى لمحور ثانوي.
  if (cfg.kind !== "combo" || !cfg.y2 || cfg.y2 === cfg.y || cfg.agg === "COUNT") return null;
  const col = info.schema.find((c) => c.name === cfg.y2);
  return col && isNumericType(col.type) ? cfg.y2 : null;
}

/** صيغة strptime مسموحة فقط بمحارف آمنة لأنها تُدرج داخل SQL. */
export function safeDateFormat(fmt: string | undefined): string | null {
  if (!fmt) return null;
  return /^[%A-Za-z0-9 :/.,-]{2,40}$/.test(fmt) ? fmt : null;
}

const DATE_CANDIDATES: { format: string; re: RegExp }[] = [
  {
    format: "%Y-%m-%d %H:%M:%S",
    re: /^(\d{4})-(\d{1,2})-(\d{1,2})[ T]\d{1,2}:\d{2}:\d{2}(?:\.\d+)?$/,
  },
  { format: "%Y-%m-%d", re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/ },
  { format: "%Y/%m/%d", re: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/ },
  { format: "%H:%M %m/%d/%Y", re: /^\d{1,2}:\d{2} (\d{1,2})\/(\d{1,2})\/(\d{4})$/ },
  { format: "%m/%d/%Y %H:%M", re: /^(\d{1,2})\/(\d{1,2})\/(\d{4}) \d{1,2}:\d{2}$/ },
  { format: "%m/%d/%Y", re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/ },
  { format: "%d-%m-%Y", re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/ },
];

export interface DateFormatGuess {
  format: string;
  /** نسبة العينات المطابقة (0–1). */
  coverage: number;
  /** صحيح عندما لا نستطيع التمييز بين يوم/شهر وشهر/يوم من العينة. */
  ambiguous: boolean;
}

/** يخمّن صيغة التاريخ من عينة قيم نصية؛ null إن لم تكن تواريخ بنسبة كافية. */
export function detectDateFormat(samples: string[], minCoverage = 0.9): DateFormatGuess | null {
  const values = samples.map((v) => v.trim()).filter((v) => v.length > 0);
  if (values.length === 0) return null;
  let best: DateFormatGuess | null = null;
  for (const cand of DATE_CANDIDATES) {
    let hit = 0;
    let firstOver12 = false;
    let secondOver12 = false;
    for (const v of values) {
      const m = cand.re.exec(v);
      if (!m) continue;
      hit++;
      if (cand.format.includes("%m/%d")) {
        if (Number(m[1]) > 12) firstOver12 = true;
        if (Number(m[2]) > 12) secondOver12 = true;
      }
    }
    const coverage = hit / values.length;
    if (coverage < minCoverage) continue;
    let format = cand.format;
    let ambiguous = false;
    if (format.includes("%m/%d")) {
      if (firstOver12 && !secondOver12) format = format.replace("%m/%d", "%d/%m");
      else if (!firstOver12 && !secondOver12) ambiguous = true;
    }
    if (!best || coverage > best.coverage) best = { format, coverage, ambiguous };
  }
  return best;
}

export interface ChartCheck {
  ok: boolean;
  problems: string[];
}

/** فحص منطقي لنقاط الرسم قبل حفظها: فراغ، سنوات غير معقولة، قيم كلها متطابقة… */
export function validateChartPoints(
  points: { label: string; value: number }[],
  opts: { temporal: boolean; kind: ChartKind },
): ChartCheck {
  const problems: string[] = [];
  if (points.length === 0) {
    return { ok: false, problems: ["الاستعلام لم يُنتج أي نقطة."] };
  }
  if (opts.temporal) {
    const badYear = points.filter((p) => {
      const y = /^(\d{4})/.exec(p.label)?.[1];
      return y === undefined || Number(y) < 1900 || Number(y) > 2100;
    });
    if (badYear.length > 0) {
      problems.push(
        `تسميات زمنية غير صالحة (مثل «${badYear[0]!.label}»)؛ يبدو أن تحويل التاريخ فشل.`,
      );
    }
  }
  if ((opts.kind === "line" || opts.kind === "area") && points.length < 2) {
    problems.push("الرسم الخطي يحتاج نقطتين على الأقل.");
  }
  if (opts.kind === "pie" && points.some((p) => p.value < 0)) {
    problems.push("الرسم الدائري لا يقبل قيماً سالبة.");
  }
  return { ok: problems.length === 0, problems };
}

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export const PALETTES: Palette[] = [
  {
    id: "basira",
    name: "MIZYAi نيون",
    colors: ["#60F5D2", "#D6B2FC", "#7DD3FC", "#FDE68A", "#F9A8D4"],
  },
  {
    id: "corporate",
    name: "أزرق الشركات",
    colors: ["#3B82F6", "#1D4ED8", "#60A5FA", "#93C5FD", "#1E3A8A"],
  },
  {
    id: "emerald",
    name: "زمردي فاخر",
    colors: ["#34D399", "#10B981", "#6EE7B7", "#A7F3D0", "#047857"],
  },
  {
    id: "sunset",
    name: "شفق غروب",
    colors: ["#A78BFA", "#FB7185", "#FDBA74", "#F472B6", "#C084FC"],
  },
];

export const CHART_KINDS: { id: ChartKind; label: string }[] = [
  { id: "bar", label: "أعمدة (Bar)" },
  { id: "horizontalBar", label: "أعمدة أفقية (Horizontal bar)" },
  { id: "line", label: "خط (Line)" },
  { id: "area", label: "مساحة منحنية (Area)" },
  { id: "pie", label: "دائري / دونات (Pie)" },
  { id: "combo", label: "مركّب (Combo)" },
  { id: "funnel", label: "قمع (Funnel)" },
  { id: "waterfall", label: "شلال (Waterfall)" },
  { id: "treemap", label: "شجاعي (Treemap)" },
  { id: "radar", label: "رادار (Radar)" },
  { id: "histogram", label: "مدرج تكراري (Histogram)" },
  { id: "boxplot", label: "صندوق وشعيرات (Box plot)" },
  { id: "scatter", label: "تشتت (Scatter)" },
  { id: "stacked", label: "أعمدة مكدسة (Stacked)" },
  { id: "heatmap", label: "خريطة حرارية (Heatmap)" },
];

/** متطلبات كل نوع جديد: تظهر للمستخدم تحت قائمة النوع. */
export const KIND_REQUIREMENTS: Partial<Record<ChartKind, string>> = {
  funnel: "فئات بقيم غير سالبة (مرحلتان فأكثر)؛ تُرتَّب من الأكبر إلى الأصغر.",
  waterfall:
    "فئات بقيم تغيّر (موجبة وسالبة)؛ يبقى المجموع التراكمي غير سالب. الترتيب يتبع الفرز المختار.",
  treemap: "فئات بقيم غير سالبة؛ مساحة كل مستطيل تمثّل حصة الفئة.",
  radar: "من 3 إلى 12 فئة بقيم غير سالبة، مقاييسها متقاربة في المقياس.",
  histogram: "عمود رقمي واحد في «المحور الرأسي (Y)»؛ يُقسَّم إلى 20 مجالاً متساوية ويُعدّ التكرار.",
  boxplot: "فئة في X وعمود رقمي في Y؛ يعرض الوسيط والربيعين والمدى لكل فئة (التجميع لا ينطبق).",
  scatter: "عمودان رقميان في X وY؛ تُعرض عيّنة حتمية حتى 500 صف (التجميع لا ينطبق).",
  stacked: "اختر «تقسيم السلاسل»؛ كل سلسلة تُكدَّس فوق الأخرى لكل فئة (الفئات تُرتَّب بمجموعها).",
  heatmap: "اختر «تقسيم السلاسل»؛ تتقاطع الفئات مع السلاسل ويُلوَّن كل خلية حسب القيمة.",
  combo: "اختر «مقياساً ثانياً» ليُرسم خطاً على محور ثانوي بوحدته الخاصة.",
};

/** عدد مجالات المدرج التكراري. */
export const HIST_BINS = 20;

/**
 * مشكلة على مستوى الحقول المختارة (قبل تنفيذ الاستعلام) تمنع النوع المطلوب.
 * ترجع null عندما تتوفر المتطلبات.
 */
export function kindFieldProblem(
  info: Pick<TableInfo, "schema">,
  cfg: Pick<ChartConfig, "kind" | "x" | "y">,
): string | null {
  const type = (name: string) => info.schema.find((c) => c.name === name)?.type ?? "";
  switch (cfg.kind) {
    case "histogram":
      return isNumericType(type(cfg.y)) ? null : "المدرج التكراري يحتاج عموداً رقمياً في Y.";
    case "boxplot":
      return isNumericType(type(cfg.y)) ? null : "الصندوق والشعيرات يحتاج عموداً رقمياً في Y.";
    case "scatter":
      return isNumericType(type(cfg.x)) && isNumericType(type(cfg.y))
        ? null
        : "التشتت يحتاج عمودين رقميين في X وY.";
    default:
      return null;
  }
}

export interface ChartFit {
  /** النوع الذي سيُرسم فعلياً. */
  kind: ChartKind;
  /** سبب الرجوع إلى بديل آمن (إن حدث). */
  notice: string | null;
}

const NON_NEGATIVE_KINDS: ChartKind[] = ["funnel", "treemap", "radar", "pie"];

/**
 * يقرّر النوع الذي يمكن رسمه بأمان لهذه النقاط. عند عدم تحقق المتطلبات يعود إلى «أعمدة»
 * مع سبب مفهوم، بدل رسم مضلل أو فارغ.
 */
export function resolveChartFit(kind: ChartKind, points: ChartPoint[]): ChartFit {
  const fallback = (notice: string): ChartFit => ({ kind: "bar", notice });
  if (kind === "pie" || kind === "funnel" || kind === "treemap" || kind === "radar") {
    if (NON_NEGATIVE_KINDS.includes(kind) && points.some((p) => p.value < 0)) {
      return kind === "pie"
        ? { kind, notice: null }
        : fallback("هذا النوع لا يقبل قيماً سالبة؛ عُرض الرسم أعمدةً بدلاً منه.");
    }
  }
  switch (kind) {
    case "funnel":
    case "treemap":
      if (points.length < 2) return fallback("يلزم فئتان على الأقل؛ عُرض الرسم أعمدةً.");
      break;
    case "radar":
      if (points.length < 3 || points.length > 12)
        return fallback("الرادار يحتاج من 3 إلى 12 فئة؛ عُرض الرسم أعمدةً.");
      break;
    case "waterfall": {
      if (points.length < 2) return fallback("الشلال يحتاج نقطتين على الأقل؛ عُرض الرسم أعمدةً.");
      let cum = 0;
      for (const p of points) {
        cum += p.value;
        if (cum < -1e-9)
          return fallback("المجموع التراكمي يهبط تحت الصفر؛ عُرض الرسم أعمدةً بدلاً من الشلال.");
      }
      break;
    }
    case "stacked":
    case "heatmap":
      if (!points.some((p) => p.series !== undefined))
        return fallback("اختر «تقسيم السلاسل» ليظهر هذا النوع؛ عُرض الرسم أعمدةً.");
      break;
    case "boxplot":
      if (points.length === 0 || points.some((p) => !p.stats))
        return fallback("بيانات الصندوق غير مكتملة؛ عُرض الرسم أعمدةً.");
      break;
    case "scatter":
      if (points.length === 0 || points.some((p) => p.x === undefined))
        return fallback("التشتت يحتاج عمودين رقميين؛ عُرض الرسم أعمدةً.");
      break;
    case "histogram":
      if (points.length === 0 || points.some((p) => p.bin === undefined))
        return fallback("المدرج التكراري يحتاج عموداً رقمياً في Y؛ عُرض الرسم أعمدةً.");
      break;
    default:
      break;
  }
  return { kind, notice: null };
}

export const AGGS: { id: AggFn; label: string }[] = [
  { id: "SUM", label: "مجموع (SUM)" },
  { id: "AVG", label: "متوسط (AVG)" },
  { id: "COUNT", label: "عدد (COUNT)" },
  { id: "MAX", label: "أعلى (MAX)" },
  { id: "MIN", label: "أدنى (MIN)" },
];

export const SORTS: { id: SortMode; label: string }[] = [
  { id: "value_desc", label: "أعلى القيم أولاً" },
  { id: "value_asc", label: "أدنى القيم أولاً" },
  { id: "label_asc", label: "ترتيب أبجدي" },
];

/** إعدادات افتراضية ذكية مشتقة من مخطط الجدول. */
export function defaultConfig(info: TableInfo, seedTitle?: string): ChartConfig {
  const numeric = info.schema.filter((c) => isNumericType(c.type));
  const ID_RE = /(^|_)(id|uuid|code|رقم|معرف)($|_)/i;
  const other = info.schema.filter((c) => !isNumericType(c.type));
  // نتجنّب أعمدة المعرّفات كمحور أفقي لأنها عالية التنوّع وغير مفيدة بصرياً.
  const x = (other.find((c) => !ID_RE.test(c.name)) ?? other[0] ?? info.schema[0])?.name ?? "";
  const y = numeric[0]?.name ?? x;
  return {
    kind: "bar",
    x,
    y,
    agg: numeric.length > 0 ? "SUM" : "COUNT",
    sort: "value_desc",
    limit: 10,
    palette: "basira",
    colors: [...PALETTES[0]!.colors],
    gradient: true,
    radius: 8,
    curve: "monotone",
    title: seedTitle?.slice(0, 80) ?? "رسم مخصص",
    subtitle: "مبني محلياً عبر DuckDB-WASM",
    align: "right",
    prefix: "",
    suffix: "",
    compact: true,
    dataLabels: false,
    grid: true,
    legend: "bottom",
    xAngle: -45,
  };
}

/** يبني استعلام SQL آمن من الإعدادات (أسماء الأعمدة مقتبسة). */
export function buildSql(info: TableInfo, cfg: ChartConfig): string {
  const t = quoteIdent(info.table);
  const x = quoteIdent(cfg.x);
  const yExpr =
    cfg.agg === "COUNT"
      ? `count(*)::DOUBLE`
      : `${cfg.agg.toLowerCase()}(${quoteIdent(cfg.y)})::DOUBLE`;
  const order =
    cfg.sort === "label_asc"
      ? `ORDER BY 1 ASC`
      : `ORDER BY 2 ${cfg.sort === "value_asc" ? "ASC" : "DESC"}`;
  const limit = cfg.limit > 0 ? `\nLIMIT ${cfg.limit}` : "";
  const special = kindFieldProblem(info, cfg) === null ? buildSpecialSql(info, cfg) : null;
  if (special) return special;
  const seriesCol = activeSeries(info, cfg);
  if (seriesCol) return buildSeriesSql(info, cfg, seriesCol, yExpr);
  const y2 = activeY2(info, cfg);
  const y2Expr = y2
    ? cfg.agg === "COUNT"
      ? `, count(*)::DOUBLE AS value2`
      : `, ${cfg.agg.toLowerCase()}(${quoteIdent(y2)})::DOUBLE AS value2`
    : "";
  const xType = info.schema.find((c) => c.name === cfg.x)?.type ?? "";
  const textFmt = safeDateFormat(cfg.dateFormat);
  const isTemporal = isTemporalColumn(info, cfg.x) || textFmt !== null;

  // تجميع زمني. الصيغ ISO فيبقى ORDER BY 1 مرتباً زمنياً.
  if (cfg.bucket && isTemporal) {
    const d = isTemporalColumn(info, cfg.x)
      ? `CAST(${x} AS DATE)`
      : `CAST(TRY_STRPTIME(CAST(${x} AS VARCHAR), '${textFmt!.replace(/'/g, "''")}') AS DATE)`;
    const fixed: Record<Exclude<TimeBucket, "auto">, string> = {
      day: `strftime(${d}, '%Y-%m-%d')`,
      week: `strftime(date_trunc('week', ${d}), '%Y-%m-%d')`,
      month: `strftime(${d}, '%Y-%m')`,
      year: `strftime(${d}, '%Y')`,
    };
    if (cfg.bucket !== "auto") {
      return `SELECT ${fixed[cfg.bucket]} AS label, ${yExpr} AS value${y2Expr}\nFROM ${t}\nWHERE ${d} IS NOT NULL\nGROUP BY 1\n${order}${limit}`;
    }
    // تلقائي: يومي حتى 90 يوماً، شهري حتى ~3 سنوات، وإلا سنوي.
    const label = `CASE WHEN _bs.span <= 90 THEN ${fixed.day} WHEN _bs.span <= 1100 THEN ${fixed.month} ELSE ${fixed.year} END`;
    return `WITH _bs AS (SELECT date_diff('day', min(${d}), max(${d})) AS span FROM ${t})\nSELECT ${label} AS label, ${yExpr} AS value${y2Expr}\nFROM ${t}, _bs\nWHERE ${d} IS NOT NULL\nGROUP BY 1\n${order}${limit}`;
  }

  // أعمدة TIMESTAMP بوقت منتصف الليل تظهر «2025-01-01 00:00:00»؛ نحذف الوقت الفارغ من التسمية فقط.
  const label = /^TIMESTAMP/i.test(xType)
    ? `regexp_replace(CAST(${x} AS VARCHAR), ' 00:00:00$', '')`
    : `CAST(${x} AS VARCHAR)`;
  return `SELECT ${label} AS label, ${yExpr} AS value${y2Expr}\nFROM ${t}\nWHERE ${x} IS NOT NULL\nGROUP BY 1\n${order}${limit}`;
}

/**
 * استعلام السلاسل: (فئة، سلسلة، قيمة). يُقصّ إلى عدد الفئات المحدد وأعلى SERIES_CAP سلاسل
 * بحسب مجموعها، ويُعيد العدد الكلي للسلاسل (n_series) ليُنبَّه المستخدم لما استُبعد.
 */
function buildSeriesSql(
  info: TableInfo,
  cfg: ChartConfig,
  seriesCol: string,
  yExpr: string,
): string {
  const t = quoteIdent(info.table);
  const x = quoteIdent(cfg.x);
  const sc = quoteIdent(seriesCol);
  const xType = info.schema.find((c) => c.name === cfg.x)?.type ?? "";
  const textFmt = safeDateFormat(cfg.dateFormat);
  const isTemporal = isTemporalColumn(info, cfg.x) || textFmt !== null;

  let cte = "";
  let from = t;
  let where = `${x} IS NOT NULL`;
  let label = /^TIMESTAMP/i.test(xType)
    ? `regexp_replace(CAST(${x} AS VARCHAR), ' 00:00:00$', '')`
    : `CAST(${x} AS VARCHAR)`;
  if (cfg.bucket && isTemporal) {
    const d = isTemporalColumn(info, cfg.x)
      ? `CAST(${x} AS DATE)`
      : `CAST(TRY_STRPTIME(CAST(${x} AS VARCHAR), '${textFmt!.replace(/'/g, "''")}') AS DATE)`;
    const fixed: Record<Exclude<TimeBucket, "auto">, string> = {
      day: `strftime(${d}, '%Y-%m-%d')`,
      week: `strftime(date_trunc('week', ${d}), '%Y-%m-%d')`,
      month: `strftime(${d}, '%Y-%m')`,
      year: `strftime(${d}, '%Y')`,
    };
    where = `${d} IS NOT NULL`;
    if (cfg.bucket === "auto") {
      cte = `_bs AS (SELECT date_diff('day', min(${d}), max(${d})) AS span FROM ${t}),\n`;
      from = `${t}, _bs`;
      label = `CASE WHEN _bs.span <= 90 THEN ${fixed.day} WHEN _bs.span <= 1100 THEN ${fixed.month} ELSE ${fixed.year} END`;
    } else {
      label = fixed[cfg.bucket];
    }
  }

  const dir = cfg.sort === "value_asc" ? "ASC" : "DESC";
  const xOrder = cfg.sort === "label_asc" ? "label ASC" : `tot ${dir}, label ASC`;
  const limit = cfg.limit > 0 ? `\nLIMIT ${cfg.limit}` : "";
  const outOrder =
    cfg.sort === "label_asc"
      ? "b.label ASC, b.series ASC"
      : `x.tot ${dir}, b.label ASC, b.series ASC`;
  return [
    `WITH ${cte}_base AS (SELECT ${label} AS label, CAST(${sc} AS VARCHAR) AS series, ${yExpr} AS value`,
    `FROM ${from}`,
    `WHERE ${where} AND ${sc} IS NOT NULL`,
    `GROUP BY 1, 2),`,
    `_xs AS (SELECT label, tot FROM (SELECT label, sum(value) AS tot FROM _base GROUP BY 1) ORDER BY ${xOrder}${limit}),`,
    `_ss AS (SELECT series FROM _base GROUP BY 1 ORDER BY sum(value) DESC, series ASC LIMIT ${SERIES_CAP})`,
    `SELECT b.label, b.series, b.value, (SELECT count(DISTINCT series) FROM _base) AS n_series`,
    `FROM _base b JOIN _xs x ON x.label = b.label JOIN _ss s ON s.series = b.series`,
    `ORDER BY ${outOrder}`,
  ].join("\n");
}

/** استعلامات الأنواع التي لا تعتمد على تجميع (فئة، قيمة) العادي. null = استعلام عادي. */
function buildSpecialSql(info: TableInfo, cfg: ChartConfig): string | null {
  const t = quoteIdent(info.table);
  const x = quoteIdent(cfg.x);
  const y = quoteIdent(cfg.y);
  switch (cfg.kind) {
    case "histogram": {
      const n = HIST_BINS;
      const w = `((_s.hi - _s.lo) / ${n})`;
      const label = `CASE WHEN _s.hi = _s.lo THEN CAST(_s.lo AS VARCHAR) ELSE CAST(round(_s.lo + g.k * ${w}, 2) AS VARCHAR) || ' – ' || CAST(round(_s.lo + (g.k + 1) * ${w}, 2) AS VARCHAR) END`;
      return [
        `WITH _s AS (SELECT min(${y})::DOUBLE AS lo, max(${y})::DOUBLE AS hi FROM ${t} WHERE ${y} IS NOT NULL),`,
        `_b AS (SELECT k, count(*) AS c FROM (SELECT CASE WHEN _s.hi = _s.lo THEN 0 ELSE LEAST(CAST(floor((${y}::DOUBLE - _s.lo) / ((_s.hi - _s.lo) / ${n})) AS INTEGER), ${n - 1}) END AS k FROM ${t}, _s WHERE ${y} IS NOT NULL) GROUP BY k)`,
        `SELECT ${label} AS label, coalesce(_b.c, 0)::DOUBLE AS value, g.k AS k`,
        `FROM generate_series(0, ${n - 1}) AS g(k) CROSS JOIN _s LEFT JOIN _b ON _b.k = g.k`,
        `WHERE _s.lo IS NOT NULL AND g.k <= CASE WHEN _s.hi = _s.lo THEN 0 ELSE ${n - 1} END`,
        `ORDER BY g.k`,
      ].join("\n");
    }
    case "boxplot": {
      const order =
        cfg.sort === "label_asc"
          ? `ORDER BY 1 ASC`
          : `ORDER BY 2 ${cfg.sort === "value_asc" ? "ASC" : "DESC"}`;
      const limit = cfg.limit > 0 ? `\nLIMIT ${cfg.limit}` : "";
      return `SELECT CAST(${x} AS VARCHAR) AS label, quantile_cont(${y}, 0.5)::DOUBLE AS value, min(${y})::DOUBLE AS lo, quantile_cont(${y}, 0.25)::DOUBLE AS q1, quantile_cont(${y}, 0.75)::DOUBLE AS q3, max(${y})::DOUBLE AS hi\nFROM ${t}\nWHERE ${x} IS NOT NULL AND ${y} IS NOT NULL\nGROUP BY 1\n${order}${limit}`;
    }
    case "scatter":
      return `SELECT CAST(${x} AS VARCHAR) AS label, ${x}::DOUBLE AS x, ${y}::DOUBLE AS value\nFROM ${t}\nWHERE ${x} IS NOT NULL AND ${y} IS NOT NULL\nORDER BY hash(${x}, ${y})\nLIMIT ${CHART_ROW_CAP + 1}`;
    default:
      return null;
  }
}

/** تنسيق الأرقام بحسب خيارات المستخدم (اختصار + بادئة/لاحقة). */
export function formatValue(v: number, cfg: Pick<ChartConfig, "prefix" | "suffix" | "compact">) {
  if (!Number.isFinite(v)) return "—";
  let body: string;
  const abs = Math.abs(v);
  if (cfg.compact && abs >= 1_000_000) body = `${(v / 1_000_000).toFixed(1)}M`;
  else if (cfg.compact && abs >= 1_000) body = `${(v / 1_000).toFixed(1)}K`;
  else body = Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2);
  return `${cfg.prefix}${body}${cfg.suffix ? ` ${cfg.suffix}` : ""}`;
}

/** أقصى عدد نقاط يُرسم في الرسم الواحد. */
export const CHART_ROW_CAP = 500;

/** يقصّ الصفوف إلى السقف ويُبلغ هل كان هناك المزيد (نطلب CAP+1 لنعرف دون تخمين). */
export function capRows<T>(rows: T[], cap = CHART_ROW_CAP): { rows: T[]; truncated: boolean } {
  return rows.length > cap
    ? { rows: rows.slice(0, cap), truncated: true }
    : { rows, truncated: false };
}

export interface ChartPoint {
  label: string;
  value: number;
  /** قيمة المحور الأفقي الرقمية (للتشتت فقط). */
  x?: number;
  /** اسم السلسلة عند تفعيل تقسيم السلاسل. */
  series?: string;
  /** القيمة الثانية للمحور الثانوي (للمركّب فقط). */
  value2?: number;
  /** رقم المجال (للمدرج التكراري فقط). */
  bin?: number;
  /** [أدنى، Q1، وسيط، Q3، أعلى] (للصندوق والشعيرات فقط). */
  stats?: [number, number, number, number, number];
}

export interface NormalizedChartRows {
  points: ChartPoint[];
  omitted: number;
  /** العدد الكلي للسلاسل في البيانات (قد يزيد عن المرسوم). */
  seriesTotal?: number;
}

/**
 * يحوّل نتائج SQL إلى نقاط قابلة للرسم دون تحويل القيم المفقودة أو غير الصالحة إلى صفر.
 * تُستبعد أيضاً أعداد BigInt التي تتجاوز دقة Number الآمنة.
 */
export function normalizeChartRows(rows: Record<string, unknown>[]): NormalizedChartRows {
  const points: ChartPoint[] = [];
  let omitted = 0;

  for (const row of rows) {
    const raw = row["value"];
    if (
      raw === null ||
      raw === undefined ||
      raw === "" ||
      typeof raw === "boolean" ||
      raw instanceof Date
    ) {
      omitted++;
      continue;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || (typeof raw === "bigint" && !Number.isSafeInteger(value))) {
      omitted++;
      continue;
    }

    const point: ChartPoint = { label: String(row["label"] ?? "—"), value };
    const rx = row["x"];
    if (rx !== undefined && rx !== null && rx !== "" && Number.isFinite(Number(rx))) {
      point.x = Number(rx);
    }
    if (typeof row["series"] === "string") point.series = row["series"];
    const rv2 = row["value2"];
    if (rv2 !== undefined && rv2 !== null && rv2 !== "" && Number.isFinite(Number(rv2))) {
      point.value2 = Number(rv2);
    }
    const rk = row["k"];
    if (rk !== undefined && rk !== null && Number.isFinite(Number(rk))) point.bin = Number(rk);
    const sv = [row["lo"], row["q1"], value, row["q3"], row["hi"]].map((v) =>
      v === null || v === undefined || v === "" ? NaN : Number(v),
    );
    if (row["lo"] !== undefined && sv.every((v) => Number.isFinite(v))) {
      point.stats = sv as [number, number, number, number, number];
    }
    points.push(point);
  }

  const total = rows.find((r) => r["n_series"] !== undefined && r["n_series"] !== null)?.[
    "n_series"
  ];
  const seriesTotal = total === undefined ? undefined : Number(total);
  return Number.isFinite(seriesTotal)
    ? { points, omitted, seriesTotal: seriesTotal as number }
    : { points, omitted };
}
