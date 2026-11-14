/**
 * Browser-local ProjectRepository for the MIZYA manifest.
 * Stores metadata only; source file contents remain in the existing local data flow.
 */
import {
  validateProjectManifest,
  type MizyaProject,
  type ProjectManifest,
  type ProjectRepository,
} from "@/lib/mizya-project";

const DB_NAME = "mizya-projects";
const DB_VERSION = 1;
const STORE = "projects";

function openProjectDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("indexeddb-unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "project.id" });
        store.createIndex("workspaceId", "project.workspaceId", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("project-db-open-failed"));
  });
}

function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openProjectDb().then((db) => new Promise<T>((resolve, reject) => {
    let result!: T;
    let failure: DOMException | Error | null = null;
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => { failure = request.error ?? new Error("project-db-request-failed"); };
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
      failure = transaction.error ?? failure ?? new Error("project-db-transaction-failed");
    };
    transaction.onabort = () => {
      db.close();
      reject(failure ?? transaction.error ?? new Error("project-db-transaction-aborted"));
    };
  }));
}

export const indexedDbProjectRepository: ProjectRepository = {
  async listProjects(workspaceId: string): Promise<MizyaProject[]> {
    const all = await transact<ProjectManifest[]>("readonly", (store) => store.getAll());
    return all
      .filter((manifest) => validateProjectManifest(manifest) && manifest.project.workspaceId === workspaceId)
      .map((manifest) => manifest.project)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async getProject(projectId: string): Promise<ProjectManifest | null> {
    const value = await transact<ProjectManifest | undefined>("readonly", (store) => store.get(projectId));
    if (!value) return null;
    if (!validateProjectManifest(value)) throw new Error("project-manifest-invalid");
    return value;
  },

  async saveProject(manifest: ProjectManifest): Promise<void> {
    if (!validateProjectManifest(manifest)) throw new Error("project-manifest-invalid");
    await transact<IDBValidKey>("readwrite", (store) => store.put(manifest));
  },

  async deleteProject(projectId: string): Promise<void> {
    await transact<undefined>("readwrite", (store) => store.delete(projectId));
  },
};
