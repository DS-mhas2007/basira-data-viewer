/**
 * توليد أسئلة مقترحة (متوقعة) من مخطط البيانات فقط — بلا أي استدعاء ذكاء اصطناعي.
 * تُعرض كاقتراحات قابلة للنقر داخل لوحة «اسأل بياناتك».
 */
import type { TableInfo } from "@/lib/duckdb-service";

export interface SuggestionGroup {
  key: string;
  label: string;
  questions: string[];
}

const DATE_RE = /(date|time|year|month|day|يوم|تاريخ|سنة|عام|شهر)/i;
const NUM_RE = /(INT|DECIMAL|DOUBLE|FLOAT|REAL|NUMERIC|HUGEINT)/i;
const ID_RE = /(^id$|_id$|id$|code|رقم|معرف)/i;

const isNumeric = (t: string) => NUM_RE.test(t);
const isDate = (t: string, n: string) => /(DATE|TIMESTAMP|TIME)/i.test(t) || DATE_RE.test(n);

/** يبني قائمة أسئلة مقترحة مصنّفة حسب نوع التحليل. */
export function buildSuggestionGroups(info: TableInfo): SuggestionGroup[] {
  const cols = info.schema;
  const dates = cols.filter((c) => isDate(c.type, c.name)).map((c) => c.name);
  const measures = cols
    .filter((c) => isNumeric(c.type) && !isDate(c.type, c.name) && !ID_RE.test(c.name))
    .map((c) => c.name);
  const cats = cols
    .filter((c) => !isNumeric(c.type) && !isDate(c.type, c.name))
    .map((c) => c.name);

  const m = measures.slice(0, 3);
  const c = cats.slice(0, 3);
  const d = dates.slice(0, 2);

  const push = (arr: string[], q: string) => {
    if (q && !arr.includes(q)) arr.push(q);
  };

  const overview: string[] = [];
  push(overview, "أعطني ملخصاً عاماً لأهم ما في هذه البيانات.");
  push(overview, `كم عدد الصفوف الإجمالي في البيانات؟`);
  for (const x of m) push(overview, `ما ملخص القيم الإحصائية لعمود «${x}» (المتوسط والأدنى والأعلى)؟`);
  for (const x of c) push(overview, `كم عدد القيم الفريدة في عمود «${x}»؟`);

  const ranking: string[] = [];
  for (const cat of c) {
    for (const me of m.slice(0, 2)) {
      push(ranking, `ما أعلى 10 قيم في «${cat}» من حيث «${me}»؟`);
      push(ranking, `ما أدنى 10 قيم في «${cat}» من حيث «${me}»؟`);
    }
    if (m.length === 0) push(ranking, `ما أكثر 10 قيم تكراراً في عمود «${cat}»؟`);
  }

  const distribution: string[] = [];
  for (const cat of c) {
    push(distribution, `ما توزيع عدد الصفوف حسب «${cat}»؟`);
    for (const me of m.slice(0, 2)) push(distribution, `ما توزيع «${me}» حسب «${cat}»؟`);
  }
  for (const me of m) push(distribution, `اعرض التوزيع التكراري (histogram) لعمود «${me}».`);

  const trend: string[] = [];
  for (const dt of d) {
    push(trend, `كيف تغيّر عدد الصفوف عبر «${dt}»؟`);
    for (const me of m.slice(0, 2)) {
      push(trend, `كيف تغيّر «${me}» عبر «${dt}»؟ اعرض الاتجاه الزمني.`);
      push(trend, `ما أفضل فترة في «${dt}» من حيث «${me}»؟`);
    }
    if (c[0]) push(trend, `قارن تغيّر «${c[0]}» عبر «${dt}».`);
  }

  const compare: string[] = [];
  if (c[0] && c[1]) push(compare, `قارن بين «${c[0]}» و«${c[1]}» من حيث عدد الصفوف.`);
  for (const me of m.slice(0, 2)) {
    if (c[0] && c[1]) push(compare, `ما متوسط «${me}» لكل «${c[0]}» مقسوماً حسب «${c[1]}»؟`);
    if (m[1] && me !== m[1]) push(compare, `هل توجد علاقة بين «${me}» و«${m[1]}»؟`);
  }

  const anomaly: string[] = [];
  for (const me of m.slice(0, 2)) {
    push(anomaly, `ما القيم الشاذة (المتطرفة) في عمود «${me}»؟`);
    push(anomaly, `ما الصفوف التي تتجاوز فيها «${me}» ضعف المتوسط؟`);
  }
  for (const cat of c.slice(0, 2)) push(anomaly, `ما القيم المفقودة أو الفارغة في عمود «${cat}»؟`);
  push(anomaly, "هل توجد صفوف مكررة في البيانات؟");

  const groups: SuggestionGroup[] = [
    { key: "overview", label: "نظرة عامة", questions: overview },
    { key: "ranking", label: "الترتيب والأعلى", questions: ranking },
    { key: "distribution", label: "التوزيع", questions: distribution },
    { key: "trend", label: "الاتجاه الزمني", questions: trend },
    { key: "compare", label: "المقارنة والعلاقات", questions: compare },
    { key: "anomaly", label: "الشذوذ والجودة", questions: anomaly },
  ];

  return groups.filter((g) => g.questions.length > 0);
}
