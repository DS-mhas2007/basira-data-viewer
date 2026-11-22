/**
 * Metric Definition Registry v1.
 *
 * Stores explicit, reviewable metric semantics and compares them with observed
 * query lineage. A match is evidence of definition alignment, never proof that
 * the source data or resulting value is correct.
 */

export type MetricDomainKind = "numeric" | "categorical" | "date" | "boolean";

export interface MetricExpectedDomain {
  kind: MetricDomainKind;
  min?: number;
  max?: number;
  allowedValues?: string[];
}

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  /** Human-readable mathematical or business definition. */
  formula: string;
  /** Explicit source dependencies; never inferred silently from formula text. */
  sourceColumns: string[];
  /** Ordered grain dimensions, e.g. ["patient_id", "month"]. */
  grain: string[];
  filters: string[];
  exclusions: string[];
  unit: string;
  expectedDomain: MetricExpectedDomain;
  assumptions: string[];
  limitations: string[];
  source: {
    dataset: string;
    version: string;
    reference?: string;
    /** Fingerprint of normalized column names/types at approval time; not a data-content hash. */
    schemaFingerprint?: string;
  };
  status: "draft" | "approved" | "deprecated";
  updatedAt: string;
}

export interface MetricSchema {
  columns: Array<{ name: string; type?: string }>;
}

/**
 * Stable, order-independent fingerprint of the active schema shape.
 * Detects column-name/type drift; it does NOT identify row values or dataset contents.
 * FNV-1a 64-bit is a compact drift detector, not a security primitive.
 */
export function computeMetricSchemaFingerprint(schema: MetricSchema): string | null {
  if (!schema || !Array.isArray(schema.columns) || schema.columns.length === 0) return null;
  const seen = new Set<string>();
  const columns: Array<{ name: string; type: string }> = [];
  for (const column of schema.columns) {
    if (!isNonEmpty(column?.name) || !isNonEmpty(column?.type)) return null;
    const name = column.name.trim().toLowerCase();
    if (seen.has(name)) return null;
    seen.add(name);
    columns.push({ name, type: column.type.trim().replace(/\s*([(),])\s*/g, "$1").replace(/\s+/g, " ").toUpperCase() });
  }
  columns.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.type < b.type ? -1 : a.type > b.type ? 1 : 0);
  const bytes = new TextEncoder().encode(JSON.stringify(columns));
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * prime);
  return "schema-v1:fnv1a64:" + hash.toString(16).padStart(16, "0");
}

export interface MetricDefinitionIssue {
  code:
    | "required"
    | "formula-not-expression"
    | "formula-unbalanced"
    | "duplicate-source-column"
    | "unknown-source-column"
    | "invalid-domain"
    | "duplicate-id"
    | "duplicate-name";
  field: string;
  message: string;
}

export interface MetricDefinitionValidation {
  valid: boolean;
  issues: MetricDefinitionIssue[];
  resolvedSourceColumns: string[];
}

export type MetricAlignmentStatus = "aligned" | "mismatch" | "insufficient-evidence";

export interface MetricAlignment {
  status: MetricAlignmentStatus;
  reasons: string[];
  definitionId: string;
}

/** Normalize whitespace only; do not rewrite SQL semantics or function names. */
export function normalizeMetricFormula(formula: string): string {
  return formula.trim().replace(/\s+/g, " ").replace(/\s*([(),])\s*/g, "$1").toLowerCase();
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formulaIsExpression(formula: string): boolean {
  const value = formula.trim();
  if (!value || value.length > 4000) return false;
  // Scan outside quoted text so a literal such as 'select' is not mistaken for a statement.
  const forbidden = new Set([
    "select", "with", "insert", "update", "delete", "drop", "alter",
    "create", "attach", "copy", "pragma", "call", "execute",
  ]);
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;
    if (quote) {
      if (char === quote && value[i + 1] === quote) {
        i++;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === ";" || (char === "-" && value[i + 1] === "-") ||
        (char === "/" && value[i + 1] === "*")) return false;
    if (/[A-Za-z_]/.test(char)) {
      let end = i + 1;
      while (end < value.length && /[A-Za-z0-9_$]/.test(value[end]!)) end++;
      if (forbidden.has(value.slice(i, end).toLowerCase())) return false;
      i = end - 1;
    }
  }
  return true;
}

function hasBalancedDelimiters(value: string): boolean {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;
    if (quote) {
      if (char === quote && value[i + 1] === quote) {
        i++;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return quote === null && depth === 0;
}

export function validateMetricDefinition(
  definition: MetricDefinition,
  schema: MetricSchema,
): MetricDefinitionValidation {
  const issues: MetricDefinitionIssue[] = [];
  const required: Array<[string, unknown]> = [
    ["id", definition.id],
    ["name", definition.name],
    ["description", definition.description],
    ["formula", definition.formula],
    ["unit", definition.unit],
    ["source.dataset", definition.source?.dataset],
    ["source.version", definition.source?.version],
    ["updatedAt", definition.updatedAt],
  ];
  for (const [field, value] of required) {
    if (!isNonEmpty(value)) {
      issues.push({ code: "required", field, message: "هذا الحقل مطلوب ولا يجوز تركه فارغاً." });
    }
  }

  if (isNonEmpty(definition.formula)) {
    if (!formulaIsExpression(definition.formula)) {
      issues.push({
        code: "formula-not-expression",
        field: "formula",
        message: "يجب أن تكون الصيغة تعبيراً حسابياً/منطقياً فقط، لا استعلاماً أو تعليمة SQL.",
      });
    } else if (!hasBalancedDelimiters(definition.formula)) {
      issues.push({
        code: "formula-unbalanced",
        field: "formula",
        message: "الأقواس أو علامات الاقتباس في الصيغة غير متوازنة.",
      });
    }
  }

  const seenColumns = new Set<string>();
  const knownColumns = new Map(schema.columns.map((column) => [column.name.toLowerCase(), column.name]));
  const resolvedSourceColumns: string[] = [];
  for (const column of definition.sourceColumns ?? []) {
    const key = column.trim().toLowerCase();
    if (seenColumns.has(key)) {
      issues.push({
        code: "duplicate-source-column",
        field: "sourceColumns",
        message: "يوجد عمود مصدر مكرر: " + column,
      });
      continue;
    }
    seenColumns.add(key);
    const resolved = knownColumns.get(key);
    if (!resolved) {
      issues.push({
        code: "unknown-source-column",
        field: "sourceColumns",
        message: "عمود المصدر غير موجود في المخطط الحالي: " + column,
      });
    } else {
      resolvedSourceColumns.push(resolved);
    }
  }

  const domain = definition.expectedDomain;
  if (!domain || !["numeric", "categorical", "date", "boolean"].includes(domain.kind)) {
    issues.push({
      code: "invalid-domain",
      field: "expectedDomain",
      message: "نوع المجال المتوقع غير صالح.",
    });
  } else if (
    (domain.min !== undefined && !Number.isFinite(domain.min)) ||
    (domain.max !== undefined && !Number.isFinite(domain.max)) ||
    (domain.min !== undefined && domain.max !== undefined && domain.min > domain.max) ||
    (domain.kind !== "numeric" && (domain.min !== undefined || domain.max !== undefined))
  ) {
    issues.push({
      code: "invalid-domain",
      field: "expectedDomain",
      message: "حدود المجال الرقمي غير صالحة أو لا تتوافق مع نوع المجال.",
    });
  }

  if (!Array.isArray(definition.grain) || definition.grain.some((item) => !isNonEmpty(item))) {
    issues.push({ code: "required", field: "grain", message: "يجب تحديد مستوى الحبيبية Grain بوضوح." });
  }
  for (const field of ["filters", "exclusions", "assumptions", "limitations"] as const) {
    if (!Array.isArray(definition[field]) || definition[field].some((item) => !isNonEmpty(item))) {
      issues.push({ code: "required", field, message: "يجب أن تكون القائمة مصفوفة من نصوص غير فارغة." });
    }
  }

  return { valid: issues.length === 0, issues, resolvedSourceColumns };
}

/** Validate registry-wide uniqueness in addition to each definition's schema. */
export function validateMetricRegistry(
  definitions: MetricDefinition[],
  schema: MetricSchema,
): MetricDefinitionValidation[] {
  const ids = new Set<string>();
  const names = new Set<string>();
  return definitions.map((definition) => {
    const result = validateMetricDefinition(definition, schema);
    const issues = [...result.issues];
    const id = definition.id.trim().toLowerCase();
    const name = definition.name.trim().toLowerCase();
    if (id && ids.has(id)) {
      issues.push({ code: "duplicate-id", field: "id", message: "معرّف المقياس مكرر." });
    }
    if (name && names.has(name)) {
      issues.push({ code: "duplicate-name", field: "name", message: "اسم المقياس مكرر." });
    }
    if (id) ids.add(id);
    if (name) names.add(name);
    return { ...result, valid: issues.length === 0, issues };
  });
}

/**
 * Compare observed SQL lineage with an approved definition.
 * Exact expression/dependency agreement is intentionally conservative.
 */
export function assessMetricAlignment(
  definition: MetricDefinition,
  observed: { expression?: string; sourceColumns?: string[]; grain?: string[] },
): MetricAlignment {
  const reasons: string[] = [];
  if (definition.status !== "approved") {
    return {
      status: "insufficient-evidence",
      definitionId: definition.id,
      reasons: ["التعريف ليس معتمداً؛ لا يمكن اعتباره مرجعاً معيارياً."],
    };
  }
  if (!isNonEmpty(observed.expression) || !Array.isArray(observed.sourceColumns)) {
    return {
      status: "insufficient-evidence",
      definitionId: definition.id,
      reasons: ["أدلة SQL أو أعمدة المصدر غير مكتملة."],
    };
  }

  if (normalizeMetricFormula(observed.expression) !== normalizeMetricFormula(definition.formula)) {
    reasons.push("صيغة SQL المرصودة لا تطابق الصيغة المسجلة حرفياً بعد تطبيع المسافات.");
  }
  const expectedColumns = [...definition.sourceColumns].map((value) => value.toLowerCase()).sort();
  const actualColumns = [...observed.sourceColumns].map((value) => value.toLowerCase()).sort();
  if (expectedColumns.length !== actualColumns.length ||
      expectedColumns.some((value, index) => value !== actualColumns[index])) {
    reasons.push("أعمدة المصدر المرصودة تختلف عن أعمدة التعريف المسجل.");
  }
  if (!Array.isArray(observed.grain)) {
    return {
      status: "insufficient-evidence",
      definitionId: definition.id,
      reasons: [...reasons, "لم تتوفر حبيبية النتيجة لمقارنتها بالحبيبية المسجلة."],
    };
  }
  const expectedGrain = definition.grain.map((value) => value.toLowerCase()).sort();
  const actualGrain = observed.grain.map((value) => value.toLowerCase()).sort();
  if (expectedGrain.length !== actualGrain.length ||
      expectedGrain.some((value, index) => value !== actualGrain[index])) {
    reasons.push("حبيبية النتيجة لا تطابق Grain المعرّف.");
  }

  return {
    status: reasons.length === 0 ? "aligned" : "mismatch",
    definitionId: definition.id,
    reasons: reasons.length ? reasons : ["الصيغة والأعمدة والحبيبية متوافقة مع التعريف المعتمد."],
  };
}


/**
 * Evidence contract consumed by the lineage gate. It intentionally mirrors only
 * the stable fields needed from MetricLineage, avoiding a runtime dependency.
 */
export interface MetricLineageEvidence {
  status: "complete" | "partial" | "unsupported";
  outputColumns: Array<{
    outputName: string;
    expression: string;
    sourceColumns: string[];
    role: "metric" | "dimension" | "derived" | "unknown";
    confidence: "high" | "medium" | "low";
  }>;
}

/**
 * Assess a definition only when the lineage layer can identify one unambiguous
 * output expression and the caller supplies independently established result
 * grain. Partial SQL lineage and guessed grain can never produce "aligned".
 */
export function assessMetricAlignmentFromLineage(
  definition: MetricDefinition,
  lineage: MetricLineageEvidence,
  verifiedGrain?: string[],
): MetricAlignment {
  const insufficient = (reason: string): MetricAlignment => ({
    status: "insufficient-evidence",
    definitionId: definition.id,
    reasons: [reason],
  });

  if (lineage.status !== "complete") {
    return insufficient("تتبّع SQL غير مكتمل؛ لا يمكن إثبات توافق المقياس.");
  }
  if (!Array.isArray(verifiedGrain) || verifiedGrain.length === 0 ||
      verifiedGrain.some((item) => !isNonEmpty(item))) {
    return insufficient("لم يتم إثبات Grain النتيجة بصورة مستقلة؛ لا يمكن إعلان التوافق.");
  }

  const candidates = lineage.outputColumns.filter((column) =>
    column.role === "metric" &&
    column.confidence === "high" &&
    normalizeMetricFormula(column.expression) === normalizeMetricFormula(definition.formula)
  );
  if (candidates.length !== 1) {
    return insufficient(
      candidates.length === 0
        ? "لم يُعثر على عمود مقياس واحد يطابق الصيغة المسجلة في أدلة SQL."
        : "توجد عدة أعمدة محتملة للصيغة نفسها؛ يلزم تحديد المقياس المقصود.",
    );
  }

  const output = candidates[0]!;
  if (output.sourceColumns.length === 0) {
    return insufficient("لم تُربط صيغة المقياس بأعمدة مصدر معروفة.");
  }

  return assessMetricAlignment(definition, {
    expression: output.expression,
    sourceColumns: output.sourceColumns,
    grain: verifiedGrain,
  });
}
