/**
 * الوحدة 5: طبقة أمان لفحص استعلامات SQL قبل تنفيذها على DuckDB.
 * طبقة داخلية فقط — لا تُستخدم بعد في أي واجهة إدخال SQL للمستخدم النهائي.
 */
import { DEFAULT_LIMIT, DEFAULT_TIMEOUT_MS, TABLE_NAME, type TableInfo } from "./duckdb-service";

export const MAX_LIMIT = 5000;
export const VALIDATOR_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

export const FORBIDDEN_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "COPY", "ATTACH",
  "DETACH", "INSTALL", "LOAD", "PRAGMA", "EXPORT", "IMPORT", "GRANT", "REVOKE",
  "TRUNCATE",
] as const;

export type ValidationRule =
  | "EMPTY_QUERY"
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

function stripStringsAndComments(sql: string) {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:''|[^'])*'/g, " '' ")
    .replace(/\$\$[\s\S]*?\$\$/g, " '' ");
}

function normalizeIdent(raw: string) {
  return raw.startsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw;
}

const IDENT = /"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*/g;

export function validateQuery(query: string, schema: SchemaRegistry): ValidationResult {
  const original = (query ?? "").trim();
  if (!original) {
    return {
      isValid: false,
      rejectionReason: "الاستعلام فارغ.",
      violatedRule: "EMPTY_QUERY",
    };
  }

  const stripped = stripStringsAndComments(original);

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

  const tokens = withoutTrailing.match(IDENT) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const name = normalizeIdent(tok);
    const lower = name.toLowerCase();
    const quoted = tok.startsWith('"');
    if (!quoted && SQL_WORDS.has(name.toUpperCase())) continue;
    if (consumed.has(lower) || aliases.has(lower)) continue;

    // استدعاء دالة: الاسم متبوع بقوس
    const rest = withoutTrailing.slice(
      withoutTrailing.indexOf(tok, 0) + tok.length,
    );
    const after = new RegExp(
      `${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`,
      "i",
    );
    if (!quoted && after.test(withoutTrailing) && rest !== undefined) continue;

    if (usableColumns.has(lower)) continue;
    if (hasCte) continue; // أعمدة مشتقة من CTE لا يمكن التحقق منها ثابتاً

    return {
      isValid: false,
      rejectionReason: `العمود «${name}» غير موجود في البيانات المحمّلة حالياً.`,
      violatedRule: "UNKNOWN_COLUMN",
    };
  }

  // 4) فرض LIMIT
  const sanitizedQuery = enforceLimit(withoutTrailing.trim(), original);
  return { isValid: true, sanitizedQuery };
}

function enforceLimit(strippedQuery: string, originalQuery: string) {
  const base = originalQuery.trim().replace(/;\s*$/, "").trim();
  const match = /\blimit\s+(\d+)\s*$/i.exec(strippedQuery);
  if (!match) return `${base} LIMIT ${DEFAULT_LIMIT}`;
  const value = Number(match[1]);
  if (value > MAX_LIMIT) {
    return base.replace(/\blimit\s+\d+\s*$/i, `LIMIT ${MAX_LIMIT}`);
  }
  return base;
}
