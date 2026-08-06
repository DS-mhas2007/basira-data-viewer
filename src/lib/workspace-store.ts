/**
 * جلسات العمل المحلية: حفظ حالة التحليل داخل IndexedDB واستعادتها بعد إغلاق الصفحة،
 * مع تصدير/استيراد المشروع كملف .basira (JSON). لا يغادر أي بايت جهاز المستخدم.
 */
import type { CleanStep } from "@/lib/cleaning";
import type { ParsedFile } from "@/lib/parse-file";
import type { PinnedInsight } from "@/lib/report";

const DB_NAME = "basira-workspace";
const STORE = "sessions";
const KEY = "current";
export const SESSION_VERSION = 1;
export const PROJECT_EXT = ".basira";

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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb-open-failed"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("idb-tx-failed"));
        t.oncomplete = () => db.close();
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
    throw new Error("ملف المشروع لا يحتوي على بيانات بصيرة صالحة.");
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