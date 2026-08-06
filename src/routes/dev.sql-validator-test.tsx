import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarField } from "@/components/StarField";
import { TABLE_NAME } from "@/lib/duckdb-service";
import { validateQuery, type SchemaRegistry, type ValidationResult } from "@/lib/sql-validator";

export const Route = createFileRoute("/dev/sql-validator-test")({
  head: () => ({
    meta: [
      { title: "اختبار مدقق SQL — بصيرة (تطوير)" },
      { name: "description", content: "صفحة تطوير داخلية لاختبار طبقة أمان استعلامات SQL في بصيرة." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "اختبار مدقق SQL — بصيرة" },
      { property: "og:description", content: "فحص استعلامات SQL دون تنفيذها فعلياً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SqlValidatorTest,
});

/** schema تجريبي ثابت لهذه الصفحة (بنفس شكل ما تسجله الوحدة 2). */
const DEMO_SCHEMA: SchemaRegistry = {
  tables: { [TABLE_NAME]: ["id", "name", "city", "amount", "created_at"] },
};

const EXAMPLES: { label: string; sql: string; expected: "قبول" | "رفض" }[] = [
  { label: "SELECT بسيط سليم", sql: `SELECT name, amount FROM ${TABLE_NAME} WHERE amount > 100 LIMIT 50`, expected: "قبول" },
  { label: "بدون LIMIT (يُضاف تلقائياً)", sql: `SELECT * FROM ${TABLE_NAME} ORDER BY amount DESC`, expected: "قبول" },
  { label: "LIMIT كبير جداً (يُخفض)", sql: `SELECT * FROM ${TABLE_NAME} LIMIT 90000`, expected: "قبول" },
  { label: "WITH صالح (CTE)", sql: `WITH t AS (SELECT city, count(*) AS n FROM ${TABLE_NAME} GROUP BY city) SELECT * FROM t ORDER BY n DESC`, expected: "قبول" },
  { label: "عمود يحتوي كلمة INSERT جزئياً", sql: `SELECT inserted_by_name FROM ${TABLE_NAME}`, expected: "رفض" },
  { label: "محاولة DROP TABLE", sql: `DROP TABLE ${TABLE_NAME}`, expected: "رفض" },
  { label: "حقن عبر semicolon متعدد", sql: `SELECT * FROM ${TABLE_NAME}; DROP TABLE ${TABLE_NAME};`, expected: "رفض" },
  { label: "عمود غير موجود", sql: `SELECT salary FROM ${TABLE_NAME}`, expected: "رفض" },
  { label: "محاولة PRAGMA", sql: `SELECT * FROM ${TABLE_NAME} WHERE 1=1 PRAGMA database_list`, expected: "رفض" },
  { label: "محاولة ATTACH", sql: `ATTACH 'other.db' AS other`, expected: "رفض" },
];

function SqlValidatorTest() {
  const [sql, setSql] = useState(EXAMPLES[0]!.sql);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const check = (q: string) => setResult(validateQuery(q, DEMO_SCHEMA));

  return (
    <div className="relative min-h-screen">
      <StarField />
      <main className="relative mx-auto max-w-3xl space-y-6 px-4 py-10">
        <header className="space-y-2">
          <p className="font-mono text-xs text-muted-foreground">/dev/sql-validator-test</p>
          <h1 className="text-2xl font-bold">اختبار مدقق استعلامات SQL</h1>
          <p className="text-sm text-muted-foreground">
            صفحة تطوير داخلية. الفحص فقط — لا يتم تنفيذ أي استعلام على DuckDB.
          </p>
        </header>

        <section className="clay space-y-3 rounded-2xl border border-border/70 bg-card p-5">
          <Textarea
            dir="ltr"
            rows={5}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="font-mono text-sm"
            placeholder="SELECT * FROM dataset"
          />
          <div className="flex items-center gap-3">
            <Button className="clay-press rounded-xl" onClick={() => check(sql)}>
              فحص
            </Button>
            <span className="text-xs text-muted-foreground">
              الأعمدة المتاحة: {DEMO_SCHEMA.tables[TABLE_NAME]!.join("، ")}
            </span>
          </div>
        </section>

        {result && (
          <section
            className={`clay space-y-3 rounded-2xl border p-5 ${
              result.isValid ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {result.isValid ? (
                <ShieldCheck className="size-5 text-primary" strokeWidth={1.75} />
              ) : (
                <ShieldAlert className="size-5 text-destructive" strokeWidth={1.75} />
              )}
              {result.isValid ? "مقبول" : "مرفوض"}
            </div>
            {result.rejectionReason && <p className="text-sm">{result.rejectionReason}</p>}
            {result.violatedRule && (
              <p className="font-mono text-xs text-muted-foreground">القاعدة: {result.violatedRule}</p>
            )}
            {result.sanitizedQuery && (
              <pre dir="ltr" className="overflow-x-auto rounded-xl bg-background/60 p-3 font-mono text-xs">
                {result.sanitizedQuery}
              </pre>
            )}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">أمثلة جاهزة</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  setSql(ex.sql);
                  check(ex.sql);
                }}
                className="clay clay-lift flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-right text-sm transition"
              >
                <span className="truncate">{ex.label}</span>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] ${
                    ex.expected === "قبول" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {ex.expected}
                </span>
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5" strokeWidth={1.75} /> المتوقع مقابل النتيجة الفعلية يجب أن يتطابقا.
          </p>
        </section>
      </main>
    </div>
  );
}
