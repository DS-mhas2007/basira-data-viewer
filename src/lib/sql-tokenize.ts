/**
 * ماسح SQL بمرور واحد من اليسار لليمين.
 * يعالج النصوص والتعليقات والمعرّفات المقتبسة معاً، فلا يمكن لنص يحتوي `--` أو `/*`
 * أن يخفي ما بعده (الثغرة السابقة كانت بسبب إزالة التعليقات قبل النصوص).
 *
 * يرفض (ok = false) كل ما قد يُفسَّر بشكل مختلف بين الماسح والمحرك:
 *  - نص أو معرّف مقتبس أو تعليق غير مغلق
 *  - تعليقات كتلة متداخلة
 *  - نصوص E'...' (تعتمد على \ للهروب)
 */

export interface ScanOk {
  ok: true;
  /** الاستعلام بعد استبدال كل نص بـ `''` وكل تعليق بمسافة. المعرّفات المقتبسة تبقى كما هي. */
  skeleton: string;
  /** الاستعلام بعد حذف التعليقات فقط (النصوص محفوظة). */
  clean: string;
}
export interface ScanFail {
  ok: false;
  reason: string;
}

const IDENT_CHAR = /[A-Za-z0-9_$]/;

export function scanSql(sql: string): ScanOk | ScanFail {
  let skeleton = "";
  let clean = "";
  const n = sql.length;
  let i = 0;

  while (i < n) {
    const ch = sql[i]!;
    const next = sql[i + 1];
    const prev = i > 0 ? sql[i - 1]! : "";

    // تعليق سطر
    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? n : end;
      skeleton += " ";
      clean += " ";
      continue;
    }

    // تعليق كتلة — لا نسمح بالتداخل لأن المحركات تختلف في معاملته
    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      if (end === -1) return { ok: false, reason: "تعليق /* غير مغلق." };
      if (sql.slice(i + 2, end).includes("/*")) {
        return { ok: false, reason: "التعليقات المتداخلة غير مسموحة." };
      }
      i = end + 2;
      skeleton += " ";
      clean += " ";
      continue;
    }

    // نص عادي '...'
    if (ch === "'") {
      if ((prev === "e" || prev === "E") && !IDENT_CHAR.test(sql[i - 2] ?? "")) {
        return { ok: false, reason: "نصوص E'...' غير مسموحة." };
      }
      let j = i + 1;
      for (;;) {
        if (j >= n) return { ok: false, reason: "نص غير مغلق." };
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      clean += sql.slice(i, j + 1);
      skeleton += " '' ";
      i = j + 1;
      continue;
    }

    // معرّف مقتبس "..."
    if (ch === '"') {
      let j = i + 1;
      for (;;) {
        if (j >= n) return { ok: false, reason: "معرّف مقتبس غير مغلق." };
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      const part = sql.slice(i, j + 1);
      clean += part;
      skeleton += part;
      i = j + 1;
      continue;
    }

    // اقتباس بالدولار $$...$$ أو $tag$...$tag$
    if (ch === "$" && !IDENT_CHAR.test(prev)) {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64));
      if (m) {
        const end = sql.indexOf(m[0], i + m[0].length);
        if (end === -1) return { ok: false, reason: "نص بالدولار غير مغلق." };
        clean += sql.slice(i, end + m[0].length);
        skeleton += " '' ";
        i = end + m[0].length;
        continue;
      }
    }

    clean += ch;
    skeleton += ch;
    i++;
  }

  return { ok: true, skeleton, clean };
}

const TRAILING_LIMIT = /\blimit\s+(\d+)(\s+offset\s+\d+)?\s*$/i;

/**
 * يضمن وجود LIMIT على مستوى الاستعلام الأعلى فقط.
 * - يتجاهل LIMIT داخل نص أو استعلام فرعي أو تعليق.
 * - يضيف الحد على سطر جديد حتى لا يقع داخل تعليق.
 * - إن مرّر maxLimit يخفض أي حد أكبر منه.
 */
export function ensureLimit(sql: string, defaultLimit: number, maxLimit?: number): string {
  const scanned = scanSql(sql);
  const base = (scanned.ok ? scanned.clean : sql).trim().replace(/;+\s*$/, "").trim();
  const skeleton = (scanned.ok ? scanned.skeleton : sql).trim().replace(/;+\s*$/, "").trim();

  const m = TRAILING_LIMIT.exec(skeleton);
  if (!m) return `${base}\nLIMIT ${defaultLimit}`;

  const value = Number(m[1]);
  if (maxLimit !== undefined && value > maxLimit) {
    return base.replace(TRAILING_LIMIT, (_all, _n, offset) => `LIMIT ${maxLimit}${offset ?? ""}`);
  }
  return base;
}
