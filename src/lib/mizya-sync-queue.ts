import { supabase } from "@/integrations/supabase/client";
import { indexedDbProjectRepository } from "@/lib/mizya-project-repository";
import { validateProjectManifest, type ProjectManifest } from "@/lib/mizya-project";
import {
  CloudProjectSyncError,
  syncProjectManifestToCloud,
  type CloudProjectIdentity,
} from "@/lib/mizya-cloud-project-repository";

const DB_NAME = "mizya-sync-queue";
const DB_VERSION = 1;
const JOBS_STORE = "jobs";
const STATES_STORE = "states";
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 5 * 60_000;
const QUEUE_EVENT = "mizya:sync-queue-changed";

export type ProjectSyncBlockReason = "auth" | "conflict" | "invalid";

export interface ProjectSyncQueueEntry {
  projectId: string;
  manifest: ProjectManifest;
  manifestFingerprint: string;
  expectedRevision?: number;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
  status: "pending" | "blocked";
  blockedReason?: ProjectSyncBlockReason;
}

export interface CloudProjectSyncState {
  localProjectId: string;
  cloudProjectId: string;
  workspaceId: string;
  revision: number;
  manifestFingerprint: string;
  lastSyncedAt: number;
}

function openQueueDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("indexeddb-unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(JOBS_STORE)) {
        db.createObjectStore(JOBS_STORE, { keyPath: "projectId" });
      }
      if (!db.objectStoreNames.contains(STATES_STORE)) {
        db.createObjectStore(STATES_STORE, { keyPath: "localProjectId" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("sync-queue-db-open-failed"));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("sync-queue-request-failed"));
  });
}

function finishTransaction<T>(db: IDBDatabase, transaction: IDBTransaction, result: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let value: T;
    let settled = false;
    result.then((next) => { value = next; }, (error) => {
      settled = true;
      db.close();
      reject(error);
    });
    transaction.oncomplete = () => {
      db.close();
      if (!settled) resolve(value!);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("sync-queue-transaction-aborted"));
    };
    transaction.onerror = () => {
      /* onabort reports the final transaction failure */
    };
  });
}

/** Stable local fingerprint; no source rows, file bytes, or credentials are included. */
export function getProjectManifestFingerprint(manifest: ProjectManifest): string {
  const serialized = JSON.stringify(manifest);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getProjectSyncRetryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * (2 ** Math.min(safeAttempt, 20)));
}

export function classifyProjectSyncError(error: unknown): ProjectSyncBlockReason | null {
  const message = error instanceof Error ? error.message : String(error);
  if (/cloud-auth-required|unauthorized|401/i.test(message)) return "auth";
  if (
    /revision-required|revision-conflict|tombstoned|manifest-invalid|source-project-mismatch|duplicate-source-id|not-owned/i.test(message)
  ) return "conflict";
  return null;
}

function dispatchQueueChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}

async function readQueueAndState(projectId: string): Promise<{
  entry: ProjectSyncQueueEntry | undefined;
  state: CloudProjectSyncState | undefined;
}> {
  const db = await openQueueDb();
  const transaction = db.transaction([JOBS_STORE, STATES_STORE], "readonly");
  const [entry, state] = await Promise.all([
    requestValue(transaction.objectStore(JOBS_STORE).get(projectId)),
    requestValue(transaction.objectStore(STATES_STORE).get(projectId)),
  ]);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("sync-queue-read-aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("sync-queue-read-failed"));
  }).finally(() => db.close());
  return { entry, state };
}

/**
 * Coalesces updates by project. A newer local manifest replaces an older pending
 * snapshot, while preserving a blocked conflict until the user explicitly resolves it.
 */
export async function enqueueProjectSync(manifest: ProjectManifest, now = Date.now()): Promise<boolean> {
  if (!validateProjectManifest(manifest)) throw new Error("project-manifest-invalid");
  const fingerprint = getProjectManifestFingerprint(manifest);
  const { entry: existing, state } = await readQueueAndState(manifest.project.id);
  if (!existing && state?.manifestFingerprint === fingerprint) return false;
  if (existing?.manifestFingerprint === fingerprint) return false;

  const next: ProjectSyncQueueEntry = {
    projectId: manifest.project.id,
    manifest,
    manifestFingerprint: fingerprint,
    expectedRevision: state?.revision,
    attempts: existing?.status === "pending" ? 0 : (existing?.attempts ?? 0),
    nextAttemptAt: existing?.status === "blocked" ? existing.nextAttemptAt : now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status: existing?.status ?? "pending",
    ...(existing?.status === "blocked" && existing.blockedReason
      ? { blockedReason: existing.blockedReason }
      : {}),
    ...(existing?.status === "blocked" && existing.lastError
      ? { lastError: existing.lastError }
      : {}),
  };

  const db = await openQueueDb();
  const transaction = db.transaction(JOBS_STORE, "readwrite");
  transaction.objectStore(JOBS_STORE).put(next);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("sync-queue-write-aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("sync-queue-write-failed"));
  }).finally(() => db.close());
  dispatchQueueChanged();
  return true;
}

/** Local-first save: the manifest is committed before its metadata-only sync job is queued. */
export async function saveProjectAndQueueSync(manifest: ProjectManifest): Promise<void> {
  await indexedDbProjectRepository.saveProject(manifest);
  try {
    await enqueueProjectSync(manifest);
  } catch (error) {
    // The local project remains safe; workspace bootstrap retries queue creation later.
    console.error("[mizya] unable to persist cloud sync job", error);
  }
}

async function listDueEntries(now: number): Promise<ProjectSyncQueueEntry[]> {
  const db = await openQueueDb();
  const transaction = db.transaction(JOBS_STORE, "readonly");
  const request = transaction.objectStore(JOBS_STORE).getAll();
  const entries = await requestValue(request);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("sync-queue-list-aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("sync-queue-list-failed"));
  }).finally(() => db.close());
  return (entries as ProjectSyncQueueEntry[])
    .filter((entry) => entry.status === "pending" && entry.nextAttemptAt <= now)
    .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);
}

async function getNextDueAt(): Promise<number | null> {
  const db = await openQueueDb();
  const transaction = db.transaction(JOBS_STORE, "readonly");
  const request = transaction.objectStore(JOBS_STORE).getAll();
  const entries = await requestValue(request);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("sync-queue-next-aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("sync-queue-next-failed"));
  }).finally(() => db.close());
  const due = (entries as ProjectSyncQueueEntry[])
    .filter((entry) => entry.status === "pending")
    .reduce<number | null>((next, entry) => next === null ? entry.nextAttemptAt : Math.min(next, entry.nextAttemptAt), null);
  return due;
}

async function completeQueueEntry(
  attempted: ProjectSyncQueueEntry,
  identity: CloudProjectIdentity,
  now: number,
): Promise<void> {
  const db = await openQueueDb();
  const transaction = db.transaction([JOBS_STORE, STATES_STORE], "readwrite");
  const jobs = transaction.objectStore(JOBS_STORE);
  const states = transaction.objectStore(STATES_STORE);
  const currentRequest = jobs.get(attempted.projectId);
  currentRequest.onsuccess = () => {
    states.put({
      localProjectId: identity.localProjectId,
      cloudProjectId: identity.id,
      workspaceId: identity.workspaceId,
      revision: identity.revision,
      manifestFingerprint: attempted.manifestFingerprint,
      lastSyncedAt: now,
    } satisfies CloudProjectSyncState);
    const current = currentRequest.result as ProjectSyncQueueEntry | undefined;
    if (!current) return;
    if (current.updatedAt === attempted.updatedAt) {
      jobs.delete(attempted.projectId);
    } else {
      jobs.put({
        ...current,
        expectedRevision: identity.revision,
        attempts: 0,
        nextAttemptAt: now,
        status: "pending",
        blockedReason: undefined,
        lastError: undefined,
      } satisfies ProjectSyncQueueEntry);
    }
  };
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("sync-queue-complete-aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("sync-queue-complete-failed"));
  }).finally(() => db.close());
}

async function failQueueEntry(
  attempted: ProjectSyncQueueEntry,
  error: unknown,
  now: number,
  partial?: Pick<CloudProjectSyncError, "cloudProjectId" | "workspaceId" | "revision">,
): Promise<void> {
  const reason = classifyProjectSyncError(error);
  const message = error instanceof Error ? error.message : String(error);
  const db = await openQueueDb();
  const transaction = db.transaction([JOBS_STORE, STATES_STORE], "readwrite");
  const jobs = transaction.objectStore(JOBS_STORE);
  const states = transaction.objectStore(STATES_STORE);
  const currentRequest = jobs.get(attempted.projectId);
  currentRequest.onsuccess = () => {
    if (partial) {
      const previousState = states.get(attempted.projectId);
      previousState.onsuccess = () => {
        const prior = previousState.result as CloudProjectSyncState | undefined;
        states.put({
          localProjectId: attempted.projectId,
          cloudProjectId: partial.cloudProjectId,
          workspaceId: partial.workspaceId,
          revision: partial.revision,
          manifestFingerprint: prior?.manifestFingerprint ?? "",
          lastSyncedAt: prior?.lastSyncedAt ?? 0,
        } satisfies CloudProjectSyncState);
      };
    }
    const current = currentRequest.result as ProjectSyncQueueEntry | undefined;
    if (!current) return;
    const attempts = current.attempts + 1;
    const blocked = reason !== null;
    jobs.put({
      ...current,
      expectedRevision: partial?.revision ?? current.expectedRevision,
      attempts,
      nextAttemptAt: blocked ? current.nextAttemptAt : now + getProjectSyncRetryDelayMs(attempts - 1),
      updatedAt: current.updatedAt,
      status: blocked ? "blocked" : "pending",
      ...(blocked ? { blockedReason: reason } : { blockedReason: undefined }),
      lastError: message.slice(0, 500),
    } satisfies ProjectSyncQueueEntry);
  };
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("sync-queue-failure-write-aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("sync-queue-failure-write-failed"));
  }).finally(() => db.close());
}

async function resumeAuthBlockedEntries(now: number): Promise<void> {
  const db = await openQueueDb();
  const transaction = db.transaction(JOBS_STORE, "readwrite");
  const store = transaction.objectStore(JOBS_STORE);
  const request = store.getAll();
  request.onsuccess = () => {
    for (const entry of request.result as ProjectSyncQueueEntry[]) {
      if (entry.status === "blocked" && entry.blockedReason === "auth") {
        store.put({ ...entry, status: "pending", blockedReason: undefined, nextAttemptAt: now, lastError: undefined });
      }
    }
  };
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("sync-queue-resume-aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("sync-queue-resume-failed"));
  }).finally(() => db.close());
}

let processing: Promise<void> | null = null;

export function processDueProjectSyncs(now = Date.now()): Promise<void> {
  if (processing) return processing;
  processing = (async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await resumeAuthBlockedEntries(now);
    const entries = await listDueEntries(now);
    for (const entry of entries) {
      try {
        const identity = await syncProjectManifestToCloud(entry.manifest, supabase, {
          expectedRevision: entry.expectedRevision,
        });
        await completeQueueEntry(entry, identity, Date.now());
      } catch (error) {
        const partial = error instanceof CloudProjectSyncError ? error : undefined;
        await failQueueEntry(entry, error, Date.now(), partial);
      }
    }
  })().finally(() => {
    processing = null;
  });
  return processing;
}

/**
 * Runs while the app is open and wakes on startup, online, visibility, auth, or
 * a newly queued local manifest. Retry deadlines are persisted, so reloads do not
 * reset backoff and no background server is required.
 */
export function startProjectSyncWorker(): () => void {
  if (typeof window === "undefined") return () => undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearRetryTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const schedule = async () => {
    clearRetryTimer();
    if (stopped) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const next = await getNextDueAt();
    if (next === null) return;
    timer = setTimeout(() => { void run(); }, Math.max(0, next - Date.now()));
  };

  const run = () => {
    if (stopped) return;
    void processDueProjectSyncs().finally(() => { void schedule(); });
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") run();
  };
  const onAuth = (_event: string, session: { user: { id: string } } | null) => {
    if (session) run();
  };

  window.addEventListener("online", run);
  window.addEventListener(QUEUE_EVENT, run);
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", onVisibility);
  const { data: authListener } = supabase.auth.onAuthStateChange(onAuth);
  run();

  return () => {
    stopped = true;
    clearRetryTimer();
    window.removeEventListener("online", run);
    window.removeEventListener(QUEUE_EVENT, run);
    window.removeEventListener("focus", run);
    document.removeEventListener("visibilitychange", onVisibility);
    authListener.subscription.unsubscribe();
  };
}
