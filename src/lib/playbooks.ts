/**
 * المحرك التلقائي لقطاعات الأعمال (Industry Playbooks).
 * يتعرّف على طبيعة البيانات من أسماء الأعمدة، ثم يحسب مؤشرات خاصة بالقطاع عبر SQL محلي.
 */
import { duckdb, quoteIdent, type TableInfo } from "@/lib/duckdb-service";
import { isNumericType } from "@/lib/profile";
import { formatNumber } from "@/lib/profile";

export type PlaybookId = "ecommerce" | "hr" | "health" | "finance" | "generic";

export interface PlaybookKpi {
  label: string;
  value: string;
  hint: string;
}

export interface PlaybookResult {
  id: PlaybookId;
  name: string;
  tagline: string;
  confidence: number; // 0..1
  matched: string[];
  kpis: PlaybookKpi[];
}

interface Signature {
  id: Exclude<PlaybookId, "generic">;
  name: string;
  tagline: string;
  /** مجموعات مرادفات: كل مجموعة تُحسب مرة واحدة. */
  groups: { key: string; re: RegExp }[];
}

const SIGNATURES: Signature[] = [
  {
    id: "ecommerce",
    name: "وضع التجارة الإلكترونية",
    tagline: "مؤشرات المبيعات والسلة والمنتجات",
    groups: [
      { key: "product", re: /(product|item|sku|منتج|صنف|سلعة)/i },
      { key: "price", re: /(price|unit_price|amount|revenue|total|sales|سعر|مبلغ|إيراد|مبيعات|إجمالي)/i },
      { key: "qty", re: /(qty|quantity|units|count|كمية|عدد)/i },
      { key: "order", re: /(order|invoice|transaction|cart|طلب|فاتورة|سلة)/i },
      { key: "customer", re: /(customer|client|buyer|عميل|زبون|مشتري)/i },
      { key: "category", re: /(category|dept|segment|فئة|تصنيف)/i },
    ],
  },
  {
    id: "hr",
    name: "وضع الموارد البشرية",
    tagline: "مؤشرات الرواتب والأقسام ودوران الموظفين",
    groups: [
      { key: "salary", re: /(salary|wage|compensation|pay|راتب|أجر|مرتب)/i },
      { key: "dept", re: /(department|dept|division|قسم|إدارة|دائرة)/i },
      { key: "employee", re: /(employee|staff|worker|emp_id|موظف|عامل)/i },
      { key: "hire", re: /(hire|hiring|join|start_date|تعيين|التحاق|مباشرة)/i },
      { key: "exit", re: /(termination|resign|exit|leave_date|استقالة|انفكاك|مغادرة)/i },
      { key: "title", re: /(title|position|role|grade|مسمى|وظيفة|درجة)/i },
    ],
  },
  {
    id: "health",
    name: "بيانات صحية",
    tagline: "مؤشرات عامة: الأعمار والحالات والمؤشرات الصحية",
    groups: [
      { key: "patient", re: /(patient|case_id|مريض|حالة)/i },
      { key: "age", re: /(age|birth|dob|عمر|السن|ميلاد)/i },
      { key: "symptom", re: /(symptom|diagnosis|disease|condition|عرض|تشخيص|مرض|حالة صحية)/i },
      { key: "visit", re: /(visit|admission|appointment|زيارة|دخول|موعد)/i },
      { key: "gender", re: /(gender|sex|جنس|النوع)/i },
      { key: "treatment", re: /(treatment|medication|drug|dose|علاج|دواء|جرعة)/i },
    ],
  },
  {
    id: "finance",
    name: "الوضع المالي / المحاسبي",
    tagline: "مؤشرات المصروفات والحسابات والتدفقات",
    groups: [
      { key: "account", re: /(account|ledger|gl_|حساب|دفتر)/i },
      { key: "debit", re: /(debit|credit|balance|مدين|دائن|رصيد)/i },
      { key: "expense", re: /(expense|cost|spend|مصروف|تكلفة|إنفاق)/i },
      { key: "budget", re: /(budget|forecast|plan|موازنة|ميزانية|خطة)/i },
      { key: "currency", re: /(currency|cur|عملة)/i },
      { key: "date", re: /(date|period|month|تاريخ|فترة|شهر)/i },
    ],
  },
];

/** يختار القطاع الأنسب بحسب تطابق أسماء الأعمدة. */
export function detectPlaybook(columns: string[]): {
  id: PlaybookId;
  name: string;
  tagline: string;
  confidence: number;
  matched: string[];
  hits: Record<string, string>;
} {
  let best: {
    sig: Signature;
    hits: Record<string, string>;
  } | null = null;

  for (const sig of SIGNATURES) {
    const hits: Record<string, string> = {};
    for (const g of sig.groups) {
      const col = columns.find((c) => g.re.test(c));
      if (col) hits[g.key] = col;
    }
    if (!best || Object.keys(hits).length > Object.keys(best.hits).length) {
      best = { sig, hits };
    }
  }

  const count = best ? Object.keys(best.hits).length : 0;
  if (!best || count < 2) {
    return {
      id: "generic",
      name: "وضع عام",
      tagline: "لم نتعرّف على قطاع محدد — نعرض مؤشرات عامة",
      confidence: 0,
      matched: [],
      hits: {},
    };
  }
  return {
    id: best.sig.id,
    name: best.sig.name,
    tagline: best.sig.tagline,
    confidence: Math.min(1, count / 4),
    matched: Object.values(best.hits),
    hits: best.hits,
  };
}

async function one(sql: string): Promise<Record<string, unknown> | null> {
  try {
    const rows = await duckdb.runSelect(sql, { limit: 1 });
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** يحسب مؤشرات القطاع محلياً عبر DuckDB. */
export async function runPlaybook(info: TableInfo): Promise<PlaybookResult> {
  const columns = info.schema.map((c) => c.name);
  const det = detectPlaybook(columns);
  const t = quoteIdent(info.table);
  const kpis: PlaybookKpi[] = [];
  const typeOf = (name: string) => info.schema.find((c) => c.name === name)?.type ?? "VARCHAR";
  const numericHit = (key: string) => {
    const col = det.hits[key];
    return col && isNumericType(typeOf(col)) ? col : undefined;
  };

  if (det.id === "ecommerce") {
    const price = numericHit("price");
    const qty = numericHit("qty");
    const order = det.hits["order"];
    const product = det.hits["product"];
    const customer = det.hits["customer"];

    if (price) {
      const revExpr = qty ? `sum(${quoteIdent(price)} * ${quoteIdent(qty)})` : `sum(${quoteIdent(price)})`;
      const r = await one(`SELECT ${revExpr}::DOUBLE AS v, avg(${quoteIdent(price)})::DOUBLE AS a FROM ${t}`);
      if (r) {
        kpis.push({ label: "إجمالي الإيرادات", value: formatNumber(n(r["v"])), hint: qty ? `${price} × ${qty}` : price });
        kpis.push({ label: "متوسط السعر", value: formatNumber(n(r["a"])), hint: price });
      }
      if (order) {
        const r2 = await one(
          `SELECT (${revExpr} / NULLIF(count(DISTINCT ${quoteIdent(order)}), 0))::DOUBLE AS v,
                  count(DISTINCT ${quoteIdent(order)})::BIGINT AS o FROM ${t}`,
        );
        if (r2) {
          kpis.push({ label: "متوسط قيمة السلة (AOV)", value: formatNumber(n(r2["v"])), hint: "الإيراد ÷ عدد الطلبات" });
          kpis.push({ label: "عدد الطلبات", value: formatNumber(n(r2["o"])), hint: order });
        }
      }
    }
    if (product) {
      const r = await one(
        `SELECT CAST(${quoteIdent(product)} AS VARCHAR) AS v, count(*)::BIGINT AS n
         FROM ${t} WHERE ${quoteIdent(product)} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
      );
      if (r) kpis.push({ label: "المنتج الأكثر تكراراً", value: String(r["v"] ?? "—"), hint: `${formatNumber(n(r["n"]))} مرة` });
    }
    if (customer) {
      const r = await one(`SELECT count(DISTINCT ${quoteIdent(customer)})::BIGINT AS v FROM ${t}`);
      if (r) kpis.push({ label: "عدد العملاء الفريدين", value: formatNumber(n(r["v"])), hint: customer });
    }
  }

  if (det.id === "hr") {
    const salary = numericHit("salary");
    const dept = det.hits["dept"];
    const emp = det.hits["employee"];
    const exitCol = det.hits["exit"];

    if (salary) {
      const r = await one(
        `SELECT avg(${quoteIdent(salary)})::DOUBLE AS a, median(${quoteIdent(salary)})::DOUBLE AS m,
                sum(${quoteIdent(salary)})::DOUBLE AS s FROM ${t}`,
      );
      if (r) {
        kpis.push({ label: "متوسط الراتب", value: formatNumber(n(r["a"])), hint: salary });
        kpis.push({ label: "الوسيط", value: formatNumber(n(r["m"])), hint: "أقل تأثراً بالقيم المتطرفة" });
        kpis.push({ label: "إجمالي كتلة الرواتب", value: formatNumber(n(r["s"])), hint: salary });
      }
      if (dept) {
        const r2 = await one(
          `SELECT CAST(${quoteIdent(dept)} AS VARCHAR) AS d, avg(${quoteIdent(salary)})::DOUBLE AS a
           FROM ${t} WHERE ${quoteIdent(dept)} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
        );
        if (r2) kpis.push({ label: "أعلى قسم أجراً", value: String(r2["d"] ?? "—"), hint: `متوسط ${formatNumber(n(r2["a"]))}` });
      }
    }
    if (dept) {
      const r = await one(`SELECT count(DISTINCT ${quoteIdent(dept)})::BIGINT AS v FROM ${t}`);
      if (r) kpis.push({ label: "عدد الأقسام", value: formatNumber(n(r["v"])), hint: dept });
    }
    if (emp) {
      const r = await one(`SELECT count(DISTINCT ${quoteIdent(emp)})::BIGINT AS v FROM ${t}`);
      if (r) kpis.push({ label: "عدد الموظفين", value: formatNumber(n(r["v"])), hint: emp });
    }
    if (exitCol) {
      const r = await one(
        `SELECT (100.0 * count(*) FILTER (WHERE ${quoteIdent(exitCol)} IS NOT NULL AND CAST(${quoteIdent(exitCol)} AS VARCHAR) <> '') / NULLIF(count(*),0))::DOUBLE AS v FROM ${t}`,
      );
      if (r) kpis.push({ label: "معدل دوران الموظفين", value: `${n(r["v"]).toFixed(1)}%`, hint: "نسبة من لديهم تاريخ مغادرة" });
    }
  }

  if (det.id === "health") {
    const age = numericHit("age");
    const patient = det.hits["patient"];
    const symptom = det.hits["symptom"];
    const gender = det.hits["gender"];

    if (patient) {
      const r = await one(`SELECT count(DISTINCT ${quoteIdent(patient)})::BIGINT AS v FROM ${t}`);
      if (r) kpis.push({ label: "عدد الحالات الفريدة", value: formatNumber(n(r["v"])), hint: patient });
    }
    if (age) {
      const r = await one(
        `SELECT avg(${quoteIdent(age)})::DOUBLE AS a, min(${quoteIdent(age)})::DOUBLE AS mn, max(${quoteIdent(age)})::DOUBLE AS mx FROM ${t}`,
      );
      if (r) {
        kpis.push({ label: "متوسط العمر", value: `${n(r["a"]).toFixed(1)} سنة`, hint: age });
        kpis.push({ label: "المدى العمري", value: `${formatNumber(n(r["mn"]))} – ${formatNumber(n(r["mx"]))}`, hint: "الأصغر والأكبر" });
      }
    }
    if (symptom) {
      const r = await one(
        `SELECT CAST(${quoteIdent(symptom)} AS VARCHAR) AS v, count(*)::BIGINT AS n
         FROM ${t} WHERE ${quoteIdent(symptom)} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
      );
      if (r) kpis.push({ label: "الحالة الأكثر شيوعاً", value: String(r["v"] ?? "—"), hint: `${formatNumber(n(r["n"]))} حالة` });
    }
    if (gender) {
      const r = await one(
        `SELECT CAST(${quoteIdent(gender)} AS VARCHAR) AS v,
                (100.0 * count(*) / NULLIF((SELECT count(*) FROM ${t}),0))::DOUBLE AS p
         FROM ${t} WHERE ${quoteIdent(gender)} IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
      );
      if (r) kpis.push({ label: "الفئة الأكبر", value: String(r["v"] ?? "—"), hint: `${n(r["p"]).toFixed(0)}% من السجلات` });
    }
  }

  if (det.id === "finance") {
    const expense = numericHit("expense") ?? numericHit("debit") ?? numericHit("budget");
    const account = det.hits["account"];
    if (expense) {
      const r = await one(
        `SELECT sum(${quoteIdent(expense)})::DOUBLE AS s, avg(${quoteIdent(expense)})::DOUBLE AS a,
                max(${quoteIdent(expense)})::DOUBLE AS mx FROM ${t}`,
      );
      if (r) {
        kpis.push({ label: "الإجمالي", value: formatNumber(n(r["s"])), hint: expense });
        kpis.push({ label: "المتوسط لكل قيد", value: formatNumber(n(r["a"])), hint: expense });
        kpis.push({ label: "أعلى قيمة مسجّلة", value: formatNumber(n(r["mx"])), hint: "قد تستحق المراجعة" });
      }
    }
    if (account) {
      const r = await one(`SELECT count(DISTINCT ${quoteIdent(account)})::BIGINT AS v FROM ${t}`);
      if (r) kpis.push({ label: "عدد الحسابات", value: formatNumber(n(r["v"])), hint: account });
    }
  }

  return {
    id: det.id,
    name: det.name,
    tagline: det.tagline,
    confidence: det.confidence,
    matched: det.matched,
    kpis: kpis.slice(0, 6),
  };
}
