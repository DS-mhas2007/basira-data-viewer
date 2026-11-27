import { isTemporalColumn, type ChartConfig } from "@/lib/chart-studio";
import { quoteIdent, type TableInfo } from "@/lib/duckdb-service";
import { isNumericType } from "@/lib/profile";

/** إحصاءات المصدر اللازمة لملخص الثقة (استعلام واحد خفيف). */
export interface SourceStats {
  total: number;
  xFilled: number;
  yFilled: number;
  categories: number;
}

export function buildSourceStatsSql(info: Pick<TableInfo, "table">, cfg: ChartConfig): string {
  const t = quoteIdent(info.table);
  const x = quoteIdent(cfg.x);
  const y = quoteIdent(cfg.y);
  return `SELECT count(*)::DOUBLE AS total, count(${x})::DOUBLE AS x_filled, count(${y})::DOUBLE AS y_filled, count(DISTINCT ${x})::DOUBLE AS categories FROM ${t}`;
}

export function parseSourceStats(row: Record<string, unknown> | undefined): SourceStats | null {
  if (!row) return null;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    total: n(row["total"]),
    xFilled: n(row["x_filled"]),
    yFilled: n(row["y_filled"]),
    categories: n(row["categories"]),
  };
}

const AGG_SENTENCE: Record<ChartConfig["agg"], string> = {
  SUM: "مجموع",
  AVG: "متوسط",
  COUNT: "عدد الصفوف",
  MAX: "أعلى قيمة",
  MIN: "أدنى قيمة",
};

const fmt = (n: number) => n.toLocaleString("en-US");
const BIDI = (v: string | number) => `⁦${v}⁩`;

export interface TrustSummary {
  /** سطر وصف ثابت: المصدر والتجميع. */
  basis: string;
  /** تحذيرات تفسيرية (قد تكون فارغة). */
  warnings: string[];
}

/**
 * ملخص يحمي القارئ من سوء التفسير: طريقة التجميع، حجم المصدر، الصفوف المستبعدة،
 * الفئات المقصوصة، وتحذيرات المقارنة غير المضمونة. دالة نقية قابلة للاختبار.
 */
export function buildTrustSummary(
  info: Pick<TableInfo, "table" | "schema">,
  cfg: ChartConfig,
  stats: SourceStats | null,
  shown: number,
): TrustSummary {
  const agg = cfg.agg === "COUNT" ? AGG_SENTENCE.COUNT : `${AGG_SENTENCE[cfg.agg]} ${cfg.y}`;
  const parts = [`${agg} لكل ${cfg.x}`];
  if (stats) parts.push(`من ${BIDI(fmt(stats.total))} صف في «${info.table}»`);
  const warnings: string[] = [];

  if (stats && stats.total > 0) {
    const missingX = stats.total - stats.xFilled;
    const missingY = stats.total - stats.yFilled;
    if (missingX > 0)
      warnings.push(
        `${BIDI(fmt(missingX))} صف بلا قيمة في «${cfg.x}» لم تدخل في الرسم (${BIDI(((missingX / stats.total) * 100).toFixed(1))}%).`,
      );
    if (missingY > 0 && cfg.agg !== "COUNT")
      warnings.push(
        `${BIDI(fmt(missingY))} صف بلا قيمة في «${cfg.y}»؛ المتوسطات والمجاميع تتجاهلها.`,
      );
    if (cfg.limit > 0 && stats.categories > shown && shown > 0)
      warnings.push(
        `يُعرض ${BIDI(fmt(shown))} من ${BIDI(fmt(stats.categories))} فئة فقط؛ الباقي مستبعد من الرسم لا من البيانات.`,
      );
  }

  const xType = info.schema.find((c) => c.name === cfg.x)?.type ?? "";
  const ordered = isTemporalColumn(info, cfg.x) || isNumericType(xType);
  if ((cfg.kind === "line" || cfg.kind === "area") && !ordered)
    warnings.push("الخط يوحي بتسلسل زمني، لكن المحور فئات نصية؛ الترتيب بينها لا يحمل معنى.");
  else if ((cfg.kind === "line" || cfg.kind === "area") && cfg.sort !== "label_asc")
    warnings.push(
      "الفرز حسب القيمة يكسر الترتيب الطبيعي للمحور؛ اختر الترتيب حسب التسمية للقراءة كاتجاه.",
    );
  if (cfg.agg === "AVG" && cfg.kind !== "histogram")
    warnings.push("المتوسط لا يُظهر حجم المجموعة؛ فئة بصف واحد تُعامَل كفئة بآلاف الصفوف.");

  return { basis: parts.join(" · "), warnings };
}
