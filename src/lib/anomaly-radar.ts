/**
 * رادار بصيرة للإشارات الغريبة (Anomaly / B.S. Detector).
 * فحوصات إحصائية منطقية تُنفَّذ محلياً عبر SQL على DuckDB.
 */
import { duckdb, quoteIdent, type TableInfo } from "@/lib/duckdb-service";
import { isDateColumn, isNumericType } from "@/lib/profile";

export type SignalLevel = "high" | "medium" | "low";

export interface AnomalySignal {
  id: string;
  level: SignalLevel;
  title: string;
  detail: string;
  column: string;
}

const AGE_RE = /(age|عمر|السن)/i;
const MONEY_RE = /(price|amount|revenue|salary|cost|total|qty|quantity|سعر|مبلغ|ايراد|إيراد|راتب|تكلفة|كمية|اجمالي|إجمالي)/i;
const ID_RE = /(^id$|_id$|معرف|رقم)/i;

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function one(sql: string) {
  const rows = await duckdb.runSelect(sql, { limit: 1 });
  return rows[0] ?? null;
}

async function safe<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function detectAnomalies(info: TableInfo): Promise<AnomalySignal[]> {
  const t = quoteIdent(info.table);
  const total = info.rowCount || 1;
  const out: AnomalySignal[] = [];
  const push = (s: AnomalySignal) => out.push(s);

  const numeric = info.schema.filter((c) => isNumericType(c.type) && !isDateColumn(c.type, c.name));
  const dates = info.schema.filter((c) => isDateColumn(c.type, c.name));
  const others = info.schema.filter((c) => !isNumericType(c.type));

  // 1) تركّز شديد: قيمة واحدة تستحوذ على معظم الصفوف
  for (const col of [...others, ...dates].slice(0, 8)) {
    await safe(async () => {
      const c = quoteIdent(col.name);
      const r = await one(
        `SELECT CAST(${c} AS VARCHAR) AS v, count(*)::BIGINT AS k,
                (SELECT count(DISTINCT ${c})::BIGINT FROM ${t}) AS d
         FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
      );
      if (!r) return null;
      const share = n(r["k"]) / total;
      const distinct = n(r["d"]);
      if (distinct === 1) {
        push({
          id: `const-${col.name}`,
          level: "low",
          column: col.name,
          title: `عمود «${col.name}» ثابت بالكامل`,
          detail: `كل الصفوف تحمل القيمة نفسها (${String(r["v"])}) — لا يضيف أي معلومة تحليلية.`,
        });
      } else if (share >= 0.6 && distinct > 2) {
        push({
          id: `conc-${col.name}`,
          level: share >= 0.8 ? "high" : "medium",
          column: col.name,
          title: `تركّز غير طبيعي في «${col.name}»`,
          detail: `${pct(share)} من الصفوف مرتبطة بقيمة واحدة فقط: «${String(r["v"])}».`,
        });
      }
      return null;
    });
  }

  for (const col of numeric.slice(0, 10)) {
    const c = quoteIdent(col.name);
    const stats = await safe(() =>
      one(
        `SELECT min(${c})::DOUBLE AS mn, max(${c})::DOUBLE AS mx, avg(${c})::DOUBLE AS av,
                coalesce(stddev_pop(${c}),0)::DOUBLE AS sd,
                count(${c})::BIGINT AS cnt,
                count(DISTINCT ${c})::BIGINT AS dis,
                count(*) FILTER (WHERE ${c} = round(${c}))::BIGINT AS rounded,
                count(*) FILTER (WHERE ${c} < 0)::BIGINT AS neg
         FROM ${t}`,
      ),
    );
    if (!stats) continue;
    const cnt = n(stats["cnt"]);
    if (cnt === 0) continue;

    // 2) أعمار مستحيلة
    if (AGE_RE.test(col.name) && (n(stats["mx"]) > 110 || n(stats["mn"]) < 0)) {
      const bad = await safe(() =>
        one(`SELECT count(*)::BIGINT AS k FROM ${t} WHERE ${c} > 110 OR ${c} < 0`),
      );
      push({
        id: `age-${col.name}`,
        level: "high",
        column: col.name,
        title: `قيم عمر غير منطقية في «${col.name}»`,
        detail: `يوجد ${n(bad?.["k"]).toLocaleString("ar-EG")} سجلاً بعمر خارج المدى المعقول (0–110)، أعلى قيمة: ${n(stats["mx"])}.`,
      });
    }

    // 3) أرقام مدوّرة بالكامل (تقديرية على الأرجح)
    const roundedShare = n(stats["rounded"]) / cnt;
    if (MONEY_RE.test(col.name) && roundedShare >= 0.98 && n(stats["dis"]) > 5 && n(stats["mx"]) >= 100) {
      push({
        id: `round-${col.name}`,
        level: "medium",
        column: col.name,
        title: `كل القيم في «${col.name}» أرقام صحيحة مدوّرة`,
        detail: `${pct(roundedShare)} من القيم بلا كسور عشرية — قد تكون أرقاماً تقديرية لا فعلية.`,
      });
    }

    // 4) قيم سالبة في عمود لا يقبل السالب منطقياً
    if (MONEY_RE.test(col.name) && n(stats["neg"]) > 0) {
      push({
        id: `neg-${col.name}`,
        level: "high",
        column: col.name,
        title: `قيم سالبة في «${col.name}»`,
        detail: `${n(stats["neg"]).toLocaleString("ar-EG")} سجلاً بقيمة أقل من صفر في عمود يُفترض أنه موجب.`,
      });
    }

    // 5) قيمة شاذة متطرفة
    const sd = n(stats["sd"]);
    if (sd > 0 && n(stats["mx"]) > n(stats["av"]) + 6 * sd) {
      push({
        id: `out-${col.name}`,
        level: "medium",
        column: col.name,
        title: `قيمة متطرفة في «${col.name}»`,
        detail: `أعلى قيمة (${n(stats["mx"]).toLocaleString("en-US")}) تبتعد أكثر من 6 انحرافات معيارية عن المتوسط (${n(stats["av"]).toFixed(2)}).`,
      });
    }
  }

  // 6) تواريخ مستقبلية
  for (const col of dates.slice(0, 4)) {
    const c = quoteIdent(col.name);
    await safe(async () => {
      const r = await one(
        `SELECT count(*)::BIGINT AS k FROM ${t} WHERE TRY_CAST(${c} AS TIMESTAMP) > now()`,
      );
      const k = n(r?.["k"]);
      if (k > 0) {
        push({
          id: `future-${col.name}`,
          level: "medium",
          column: col.name,
          title: `تواريخ مستقبلية في «${col.name}»`,
          detail: `${k.toLocaleString("ar-EG")} سجلاً يحمل تاريخاً بعد اليوم — تحقق من صحة الإدخال.`,
        });
      }
      return null;
    });
  }

  // 7) معرّفات مكررة
  for (const col of info.schema.filter((c) => ID_RE.test(c.name)).slice(0, 3)) {
    const c = quoteIdent(col.name);
    await safe(async () => {
      const r = await one(
        `SELECT count(DISTINCT ${c})::BIGINT AS d, count(${c})::BIGINT AS k FROM ${t}`,
      );
      const d = n(r?.["d"]);
      const k = n(r?.["k"]);
      if (k > 0 && d < k) {
        push({
          id: `dupid-${col.name}`,
          level: "high",
          column: col.name,
          title: `تكرار في المعرّف «${col.name}»`,
          detail: `${(k - d).toLocaleString("ar-EG")} قيمة مكررة في عمود يُفترض أن يكون فريداً.`,
        });
      }
      return null;
    });
  }

  const order: Record<SignalLevel, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]).slice(0, 8);
}