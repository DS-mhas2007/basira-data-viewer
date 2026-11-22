/**
 * جلسات العمل المحلية: حفظ حالة التحليل داخل IndexedDB واستعادتها بعد إغلاق الصفحة،
 * مع تصدير/استيراد المشروع كملف .basira (JSON). لا يغادر أي بايت جهاز المستخدم.
 */
import type { CleanStep } from "@/lib/cleaning";
import type { ParsedFile } from "@/lib/parse-file";
import type { PinnedInsight } from "@/lib/report";
import type { MetricDefinition } from "@/lib/metric-definition-registry";

const DB_NAME = "basira-workspace";
const STORE = "sessions";
const KEY = "current";
export const SESSION_VERSION = 1;
export const PROJECT_EXT = ".basira";

export const METRIC_DEFINITION_REGISTRY_VERSION = 1;

interface StoredMetricDefinitionRegistry {
  version: number;
  savedAt: number;
  definitions: MetricDefinition[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isMetricDefinition(value: unknown): value is MetricDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<MetricDefinition>;
  const domain = item.expectedDomain;
  const source = item.source;
  return typeof item.id === "string" && item.id.trim().length > 0 &&
    typeof item.name === "string" && item.name.trim().length > 0 &&
    typeof item.description === "string" &&
    typeof item.formula === "string" &&
    isStringArray(item.sourceColumns) &&
    isStringArray(item.grain) &&
    isStringArray(item.filters) &&
    isStringArray(item.exclusions) &&
    typeof item.unit === "string" &&
    !!domain && typeof domain === "object" &&
    ["numeric", "categorical", "date", "boolean"].includes(domain.kind) &&
    (domain.min === undefined || (typeof domain.min === "number" && Number.isFinite(domain.min))) &&
    (domain.max === undefined || (typeof domain.max === "number" && Number.isFinite(domain.max))) &&
    (domain.allowedValues === undefined || isStringArray(domain.allowedValues)) &&
    isStringArray(item.assumptions) &&
    isStringArray(item.limitations) &&
    !!source && typeof source === "object" &&
    typeof source.dataset === "string" && typeof source.version === "string" &&
    (source.reference === undefined || typeof source.reference === "string") &&
    (source.schemaFingerprint === undefined ||
      (typeof source.schemaFingerprint === "string" && /^schema-v1:fnv1a64:[0-9a-f]{16}$/.test(source.schemaFingerprint))) &&
    (source.contentFingerprint === undefined ||
      (typeof source.contentFingerprint === "string" && /^content-v1:sha256:[0-9a-f]{64}$/.test(source.contentFingerprint))) &&
    (source.transformationFingerprint === undefined ||
      (typeof source.transformationFingerprint === "string" && /^transform-v1:sha256:[0-9a-f]{64}$/.test(source.transformationFingerprint))) &&
    (source.outputFingerprint === undefined ||
      (typeof source.outputFingerprint === "string" && /^output-v1:sha256:[0-9a-f]{64}$/.test(source.outputFingerprint))) &&
    ["draft", "approved", "deprecated"].includes(item.status ?? "") &&
    typeof item.updatedAt === "string";
}

function isMetricDefinitionRegistry(value: unknown): value is StoredMetricDefinitionRegistry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const registry = value as Partial<StoredMetricDefinitionRegistry>;
  if (registry.version !== METRIC_DEFINITION_REGISTRY_VERSION ||
      !Number.isFinite(registry.savedAt) ||
      !Array.isArray(registry.definitions) ||
      !registry.definitions.every(isMetricDefinition)) return false;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const definition of registry.definitions) {
    const id = definition.id.trim().toLowerCase();
    const name = definition.name.trim().toLowerCase();
    if (ids.has(id) || names.has(name)) return false;
    ids.add(id);
    names.add(name);
  }
  return true;
}

/** Save a project's metric definitions in its own IndexedDB key. */
export async function saveProjectMetricDefinitions(
  projectId: string,
  definitions: MetricDefinition[],
): Promise<boolean> {
  if (!projectId.trim() || !isSessionSupported() ||
      !Array.isArray(definitions) || !definitions.every(isMetricDefinition)) return false;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const definition of definitions) {
    const id = definition.id.trim().toLowerCase();
    const name = definition.name.trim().toLowerCase();
    if (ids.has(id) || names.has(name)) return false;
    ids.add(id);
    names.add(name);
  }
  try {
    const registry: StoredMetricDefinitionRegistry = {
      version: METRIC_DEFINITION_REGISTRY_VERSION,
      savedAt: Date.now(),
      definitions: definitions.map((definition) => structuredClone(definition)),
    };
    await tx("readwrite", (store) => store.put(registry, `metric-definitions:${projectId}`));
    return true;
  } catch (error) {
    console.error("[mizya] saveProjectMetricDefinitions failed", error);
    return false;
  }
}

/** Load only the metric registry belonging to the requested project. */
export async function loadProjectMetricDefinitions(
  projectId: string,
): Promise<MetricDefinition[] | null> {
  if (!projectId.trim() || !isSessionSupported()) return null;
  try {
    const value = await tx<unknown>(
      "readonly",
      (store) => store.get(`metric-definitions:${projectId}`),
    );
    if (!isMetricDefinitionRegistry(value)) return null;
    return value.definitions.map((definition) => structuredClone(definition));
  } catch {
    return null;
  }
}

/** Remove one project's metric registry without touching its session or other projects. */
export async function clearProjectMetricDefinitions(projectId: string): Promise<boolean> {
  if (!projectId.trim() || !isSessionSupported()) return false;
  try {
    await tx("readwrite", (store) => store.delete(`metric-definitions:${projectId}`));
    return true;
  } catch (error) {
    console.error("[mizya] clearProjectMetricDefinitions failed", error);
    return false;
  }
}


export interface WorkspaceSession {
  version: number;
  savedAt: number;
  /** الملف المقروء كاملاً (كل الأوراق) لإعادة تحميله في DuckDB. */
  file: ParsedFile;
  sheet: string;
  cleanSteps: CleanStep[];
  pinned: PinnedInsight[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("idb-open-failed"));
  });
}

/**
 * Resolves only after the transaction commits, not merely when its request
 * succeeds. This prevents reporting a successful local save before IndexedDB
 * has durably completed the write.
 */
function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result!: T;
        let failure: DOMException | Error | null = null;
        let transaction: IDBTransaction;

        try {
          transaction = db.transaction(STORE, mode);
          const request = run(transaction.objectStore(STORE));
          request.onsuccess = () => {
            result = request.result;
          };
          request.onerror = () => {
            failure = request.error ?? new Error("idb-request-failed");
          };
        } catch (error) {
          db.close();
          reject(error);
          return;
        }

        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };
        transaction.onerror = () => {
          failure = transaction.error ?? failure ?? new Error("idb-transaction-failed");
        };
        transaction.onabort = () => {
          db.close();
          reject(failure ?? transaction.error ?? new Error("idb-transaction-aborted"));
        };
      }),
  );
}

export function isSessionSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

/** يحفظ لقطة الجلسة الحالية (يتجاهل الأخطاء حتى لا تُعطّل الواجهة). */
export async function saveSession(input: Omit<WorkspaceSession, "version" | "savedAt">): Promise<boolean> {
  if (!isSessionSupported()) return false;
  try {
    const session: WorkspaceSession = { ...input, version: SESSION_VERSION, savedAt: Date.now() };
    await tx("readwrite", (s) => s.put(session, KEY));
    return true;
  } catch (e) {
    console.error("[basira] saveSession failed", e);
    return false;
  }
}

export async function loadSession(): Promise<WorkspaceSession | null> {
  if (!isSessionSupported()) return null;
  try {
    const value = await tx<WorkspaceSession | undefined>("readonly", (s) => s.get(KEY));
    if (!value || value.version !== SESSION_VERSION || !value.file?.sheets) return null;
    return value;
  } catch {
    return null;
  }
}

/** Stores an independent local analysis snapshot for one MIZYA project. */
export async function saveProjectSession(
  projectId: string,
  input: Omit<WorkspaceSession, "version" | "savedAt">,
): Promise<boolean> {
  if (!projectId.trim() || !isSessionSupported()) return false;
  try {
    const session: WorkspaceSession = { ...input, version: SESSION_VERSION, savedAt: Date.now() };
    await tx("readwrite", (store) => store.put(session, `project:${projectId}`));
    return true;
  } catch (error) {
    console.error("[mizya] saveProjectSession failed", error);
    return false;
  }
}

/** Loads only the snapshot owned by the requested project. */
export async function loadProjectSession(projectId: string): Promise<WorkspaceSession | null> {
  if (!projectId.trim() || !isSessionSupported()) return null;
  try {
    const value = await tx<WorkspaceSession | undefined>(
      "readonly",
      (store) => store.get(`project:${projectId}`),
    );
    if (!value || value.version !== SESSION_VERSION || !value.file?.sheets) return null;
    return value;
  } catch {
    return null;
  }
}

/** Removes one project's local data snapshot without touching other projects. */
export async function clearProjectSession(projectId: string): Promise<void> {
  if (!projectId.trim() || !isSessionSupported()) return;
  try {
    await tx("readwrite", (store) => store.delete(`project:${projectId}`));
  } catch {
    /* Local cleanup is best-effort; the project manifest remains intact. */
  }
}

/** Persists the parsed file independently from the active analysis snapshot. */
export async function saveProjectSourceFile(
  projectId: string,
  sourceId: string,
  file: ParsedFile,
): Promise<boolean> {
  if (!projectId.trim() || !sourceId.trim() || !isSessionSupported()) return false;
  try {
    await tx("readwrite", (store) =>
      store.put(file, `project-source:${projectId}:${sourceId}`),
    );
    return true;
  } catch (error) {
    console.error("[mizya] saveProjectSourceFile failed", error);
    return false;
  }
}

/** Retrieves one project's source payload without exposing another project's files. */
export async function loadProjectSourceFile(
  projectId: string,
  sourceId: string,
): Promise<ParsedFile | null> {
  if (!projectId.trim() || !sourceId.trim() || !isSessionSupported()) return null;
  try {
    const value = await tx<ParsedFile | undefined>(
      "readonly",
      (store) => store.get(`project-source:${projectId}:${sourceId}`),
    );
    if (!value || !Array.isArray(value.sheetNames) || !value.sheets) return null;
    return value;
  } catch {
    return null;
  }
}

/** Removes a source payload when its owning source is deleted. */
export async function clearProjectSourceFile(projectId: string, sourceId: string): Promise<boolean> {
  if (!projectId.trim() || !sourceId.trim() || !isSessionSupported()) return false;
  try {
    await tx("readwrite", (store) =>
      store.delete(`project-source:${projectId}:${sourceId}`),
    );
    return true;
  } catch (error) {
    console.error("[mizya] clearProjectSourceFile failed", error);
    return false;
  }
}

export async function clearSession(): Promise<void> {
  if (!isSessionSupported()) return;
  try {
    await tx("readwrite", (s) => s.delete(KEY));
  } catch {
    /* تجاهل */
  }
}

/** وقت نسبي بالعربية: «قبل 3 دقائق». */
export function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.round(diff / 60000);
  if (m < 1) return "قبل لحظات";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
}

/* ============ ملف المشروع .basira ============ */

export function projectFileName(sourceName: string, d = new Date()): string {
  const base = sourceName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "مشروع";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}${PROJECT_EXT}`;
}

export function isProjectFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(PROJECT_EXT) || file.name.toLowerCase().endsWith(".json");
}

/** ينزّل الجلسة كملف مشروع صغير قابل للمشاركة والاسترجاع. */
export function downloadProject(session: Omit<WorkspaceSession, "version" | "savedAt">): void {
  const payload: WorkspaceSession = { ...session, version: SESSION_VERSION, savedAt: Date.now() };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = projectFileName(session.file.fileName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** يقرأ ملف مشروع ويتحقق من بنيته. */
export async function readProjectFile(file: File): Promise<WorkspaceSession> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("ملف المشروع غير صالح — تعذّرت قراءة محتواه.");
  }
  const s = parsed as Partial<WorkspaceSession>;
  if (!s || typeof s !== "object" || !s.file || !s.file.sheets || !s.file.sheetNames) {
    throw new Error("ملف المشروع لا يحتوي على بيانات MIZYAi صالحة.");
  }
  if (s.version !== SESSION_VERSION) {
    throw new Error("إصدار ملف المشروع غير مدعوم في هذه النسخة.");
  }
  return {
    version: SESSION_VERSION,
    savedAt: typeof s.savedAt === "number" ? s.savedAt : Date.now(),
    file: s.file,
    sheet: s.sheet ?? s.file.sheetNames[0] ?? "",
    cleanSteps: s.cleanSteps ?? [],
    pinned: s.pinned ?? [],
  };
}