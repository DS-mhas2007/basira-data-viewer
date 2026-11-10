/**
 * الوحدة 5: طبقة أمان لفحص استعلامات SQL قبل تنفيذها على DuckDB.
 * طبقة داخلية فقط — لا تُستخدم بعد في أي واجهة إدخال SQL للمستخدم النهائي.
 */
import { DEFAULT_LIMIT, DEFAULT_TIMEOUT_MS, duckdb, type TableInfo } from "./duckdb-service";
import type { Row } from "./parse-file";
import { ensureLimit, scanSql } from "./sql-tokenize";

export const MAX_LIMIT = 5000;
export const VALIDATOR_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

export const FORBIDDEN_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "COPY", "ATTACH",
  "DETACH", "INSTALL", "LOAD", "PRAGMA", "EXPORT", "IMPORT", "GRANT", "REVOKE",
  "TRUNCATE",
] as const;

export type ValidationRule =
  | "EMPTY_QUERY"
  | "MALFORMED_QUERY"
  | "FORBIDDEN_FUNCTION"
  | "MUST_START_WITH_SELECT_OR_WITH"
  | "FORBIDDEN_KEYWORD"
  | "MULTIPLE_STATEMENTS"
  | "UNKNOWN_TABLE"
  | "UNKNOWN_COLUMN";

export interface ValidationResult {
  isValid: boolean;
  sanitizedQuery?: string;
  rejectionReason?: string;
  violatedRule?: ValidationRule;
}

export interface SchemaRegistry {
  tables: Record<string, string[]>; // اسم الجدول -> أسماء الأعمدة
}

export function schemaFromTableInfo(info: TableInfo | null | undefined): SchemaRegistry {
  if (!info) return { tables: {} };
  return { tables: { [info.table]: info.schema.map((c) => c.name) } };
}

/** كلمات SQL المسموحة التي قد تظهر كمعرّفات ظاهرياً. */
const SQL_WORDS = new Set(
  `SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET AS ON AND OR NOT IN IS NULL LIKE ILIKE
   BETWEEN CASE WHEN THEN ELSE END JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL USING UNION ALL
   EXCEPT INTERSECT DISTINCT WITH RECURSIVE ASC DESC NULLS FIRST LAST TRUE FALSE CAST TRY_CAST
   EXISTS ANY SOME OVER PARTITION ROWS RANGE PRECEDING FOLLOWING CURRENT ROW UNBOUNDED FILTER
   QUALIFY WINDOW LATERAL VALUES INTERVAL DAY MONTH YEAR HOUR MINUTE SECOND EPOCH
   INT INTEGER BIGINT DOUBLE FLOAT DECIMAL NUMERIC VARCHAR TEXT STRING BOOLEAN DATE TIMESTAMP TIME BLOB JSON
   ESCAPE COLLATE SIMILAR TO GLOB`
    .split(/\s+/)
    .filter(Boolean),
);

function normalizeIdent(raw: string) {
  return raw.startsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw;
}

const IDENT = /"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*/g;


/** دوال تقرأ ملفات أو تكشف بيئة المحرك — ممنوعة في أي موضع. الأفضل مستقبلاً allow-list. */
const DANGEROUS_FUNCTION =
  /^(read_|scan_|parquet_|iceberg_|delta_|sniff_|pragma_|duckdb_|http|force_|st_read)|_scan(_|$)|^(glob|getenv|current_setting|query|query_table|which_secret|list_secrets)$/i;

/** دوال جدولية مسموحة في موضع الجدول. */
const ALLOWED_TABLE_FUNCTIONS = new Set(["unnest", "generate_series", "range", "generate_subscripts"]);

const CLAUSE_END = new Set([
  "where", "group", "order", "having", "limit", "offset", "qualify", "window",
  "union", "except", "intersect", "select", "fetch",
]);

const TOKEN = /"(?:[^"]|"")*"|''|[A-Za-z_][A-Za-z0-9_$]*|\d+(?:\.\d+)?|\S/g;

function reject(rule: ValidationRule, reason: string): ValidationResult {
  return { isValid: false, rejectionReason: reason, violatedRule: rule };
}

/**
 * فحص بنيوي على الاستعلام بعد تجريده:
 *  - أي دالة خطرة (read_csv, glob, getenv…) في أي موضع.
 *  - نص حرفي كمصدر جدول (FROM 'x.csv' أو FROM a, 'x.csv').
 *  - دالة جدولية غير مسموحة أو جدول غير معروف بعد الفاصلة (FROM dataset, other).
 */
function checkStructure(
  skeleton: string,
  known: Map<string, Set<string>>,
  cteNames: Set<string>,
): ValidationResult | null {
  const tokens = skeleton.match(TOKEN) ?? [];
  const isIdent = (t: string | undefined) => !!t && (t.startsWith('"') || /^[A-Za-z_]/.test(t));

  const inFrom: boolean[] = [false];
  const isFunc: boolean[] = [false];
  let depth = 0;
  // "first": الرمز بعد FROM/JOIN مباشرة، "comma": بعد فاصلة في قائمة الجداول
  let expect: "first" | "comma" | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const lower = tok.toLowerCase();
    const prev = tokens[i - 1];

    if (isIdent(tok) && tokens[i + 1] === "(") {
      const fname = normalizeIdent(tok);
      if (DANGEROUS_FUNCTION.test(fname)) {
        return reject("FORBIDDEN_FUNCTION", `الدالة «${fname}» غير مسموحة (قراءة ملفات أو معلومات النظام).`);
      }
    }

    if (tok === "(") {
      depth++;
      isFunc[depth] = isIdent(prev) && !(prev && !prev.startsWith('"') && SQL_WORDS.has(prev.toUpperCase()));
      inFrom[depth] = false;
      expect = null;
      continue;
    }
    if (tok === ")") {
      depth = Math.max(0, depth - 1);
      expect = null;
      continue;
    }

    // داخل استدعاء دالة، FROM/JOIN جزء من تعبير (extract / substring…) وليس مصدر جدول
    if (isFunc[depth]) continue;

    if (expect) {
      const which = expect;
      expect = null;
      if (tok === "''") {
        return reject("UNKNOWN_TABLE", "لا يُسمح باستخدام نص حرفي (ملف أو رابط) كمصدر بيانات.");
      }
      if (isIdent(tok)) {
        const name = normalizeIdent(tok).toLowerCase();
        const nextTok = tokens[i + 1];
        if (nextTok === "(") {
          if (!ALLOWED_TABLE_FUNCTIONS.has(name)) {
            return reject("FORBIDDEN_FUNCTION", `الدالة الجدولية «${normalizeIdent(tok)}» غير مسموحة.`);
          }
        } else if (which === "comma") {
          const bare = !tok.startsWith('"');
          const isKeyword = bare && SQL_WORDS.has(tok.toUpperCase());
          if (!isKeyword && (nextTok === "." || (!known.has(name) && !cteNames.has(name)))) {
            return reject("UNKNOWN_TABLE", `الجدول «${normalizeIdent(tok)}» غير موجود في البيانات المحمّلة حالياً.`);
          }
        }
      }
      continue;
    }

    if (lower === "from" || lower === "join") {
      inFrom[depth] = true;
      expect = "first";
      continue;
    }
    if (tok === ",") {
      if (inFrom[depth]) expect = "comma";
      continue;
    }
    if (CLAUSE_END.has(lower)) inFrom[depth] = false;
  }
  return null;
}

export function validateQuery(query: string, schema: SchemaRegistry): ValidationResult {
  const original = (query ?? "").trim();
  if (!original) {
    return {
      isValid: false,
      rejectionReason: "الاستعلام فارغ.",
      violatedRule: "EMPTY_QUERY",
    };
  }

  const scan = scanSql(original);
  if (!scan.ok) {
    return {
      isValid: false,
      rejectionReason: `الاستعلام غير صالح: ${scan.reason}`,
      violatedRule: "MALFORMED_QUERY",
    };
  }
  const stripped = scan.skeleton;

  // 2) منع الاستعلامات المتعددة
  const withoutTrailing = stripped.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    return {
      isValid: false,
      rejectionReason:
        "يُمنع تنفيذ أكثر من استعلام واحد. أزل الفاصلة المنقوطة (;) التي تفصل بين الجمل.",
      violatedRule: "MULTIPLE_STATEMENTS",
    };
  }

  // 1) يجب أن يبدأ بـ SELECT أو WITH
  if (!/^\s*(select|with)\b/i.test(withoutTrailing)) {
    return {
      isValid: false,
      rejectionReason: "يُسمح فقط باستعلامات القراءة التي تبدأ بـ SELECT أو WITH.",
      violatedRule: "MUST_START_WITH_SELECT_OR_WITH",
    };
  }

  // 1) الكلمات المحجوزة (ككلمات مستقلة فقط)
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`(?<![A-Za-z0-9_$"])${kw}(?![A-Za-z0-9_$"])`, "i");
    if (re.test(withoutTrailing)) {
      return {
        isValid: false,
        rejectionReason: `الاستعلام يحتوي على الكلمة المحجوزة «${kw}» وهي غير مسموحة في طبقة القراءة فقط.`,
        violatedRule: "FORBIDDEN_KEYWORD",
      };
    }
  }

  // 3) التحقق من الجداول والأعمدة
  const known = new Map<string, Set<string>>();
  for (const [t, cols] of Object.entries(schema.tables)) {
    known.set(t.toLowerCase(), new Set(cols.map((c) => c.toLowerCase())));
  }

  const cteNames = new Set<string>();
  for (const m of withoutTrailing.matchAll(
    /(?:with|,)\s+("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)\s*(?:\([^)]*\))?\s+as\s*\(/gi,
  )) {
    cteNames.add(normalizeIdent(m[1]!).toLowerCase());
  }

  const structural = checkStructure(withoutTrailing, known, cteNames);
  if (structural) return structural;

  const aliases = new Set<string>();
  for (const m of withoutTrailing.matchAll(/\bas\s+("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)/gi)) {
    aliases.add(normalizeIdent(m[1]!).toLowerCase());
  }

  // مراجع الجداول بعد FROM / JOIN
  const tableRefs: { name: string; alias?: string }[] = [];
  for (const m of withoutTrailing.matchAll(
    /\b(?:from|join)\s+("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s+(?:as\s+)?("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*))?/gi,
  )) {
    const name = normalizeIdent(m[1]!);
    const aliasRaw = m[2] ? normalizeIdent(m[2]) : undefined;
    const alias = aliasRaw && !SQL_WORDS.has(aliasRaw.toUpperCase()) ? aliasRaw : undefined;
    tableRefs.push({ name, ...(alias ? { alias } : {}) });
    if (alias) aliases.add(alias.toLowerCase());
  }

  const usableColumns = new Set<string>();
  for (const ref of tableRefs) {
    const key = ref.name.toLowerCase();
    if (cteNames.has(key)) continue;
    const cols = known.get(key);
    if (!cols) {
      return {
        isValid: false,
        rejectionReason: `الجدول «${ref.name}» غير موجود في البيانات المحمّلة حالياً.`,
        violatedRule: "UNKNOWN_TABLE",
      };
    }
    for (const c of cols) usableColumns.add(c);
  }
  // أعمدة الـ CTE غير معروفة مسبقاً — نسمح بالأسماء المعرَّفة كـ aliases داخلها
  const hasCte = cteNames.size > 0;

  // المعرّفات المتبقية = أعمدة محتملة
  const consumed = new Set<string>();
  for (const ref of tableRefs) {
    consumed.add(ref.name.toLowerCase());
    if (ref.alias) consumed.add(ref.alias.toLowerCase());
  }
  for (const n of cteNames) consumed.add(n);

  const funcNames = new Set<string>();
  for (const m of withoutTrailing.matchAll(/([A-Za-z_][A-Za-z0-9_$]*)\s*\(/g)) {
    funcNames.add(m[1]!.toLowerCase());
  }

  const tokens = withoutTrailing.match(IDENT) ?? [];
  for (const tok of tokens) {
    const name = normalizeIdent(tok);
    const lower = name.toLowerCase();
    const quoted = tok.startsWith('"');
    if (!quoted && SQL_WORDS.has(name.toUpperCase())) continue;
    if (consumed.has(lower) || aliases.has(lower)) continue;
    if (!quoted && funcNames.has(lower)) continue;
    if (usableColumns.has(lower)) continue;
    if (hasCte) continue; // أعمدة مشتقة من CTE لا يمكن التحقق منها ثابتاً

    return {
      isValid: false,
      rejectionReason: `العمود «${name}» غير موجود في البيانات المحمّلة حالياً.`,
      violatedRule: "UNKNOWN_COLUMN",
    };
  }

  // 4) فرض LIMIT على مستوى الاستعلام الأعلى (بعد حذف التعليقات)
  const sanitizedQuery = ensureLimit(scan.clean, DEFAULT_LIMIT, MAX_LIMIT);
  return { isValid: true, sanitizedQuery };
}

/** ينفّذ الاستعلام بعد فحصه فقط، مع نفس آلية المهلة الزمنية في الوحدة 2. */
export async function runValidatedQuery(
  query: string,
  schema: SchemaRegistry,
): Promise<{ result: ValidationResult; rows?: Row[] }> {
  const result = validateQuery(query, schema);
  if (!result.isValid || !result.sanitizedQuery) return { result };
  const rows = await duckdb.runSelect(result.sanitizedQuery, {
    timeoutMs: VALIDATOR_TIMEOUT_MS,
    limit: MAX_LIMIT,
  });
  return { result, rows };
}
