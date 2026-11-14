/**
 * MIZYA project domain — additive foundation over the existing Basira session model.
 * This module deliberately stores source descriptors, never raw credentials or file bytes.
 */

export const MIZYA_PROJECT_SCHEMA_VERSION = 1 as const;

export type DataSourceKind =
  | "csv"
  | "xlsx"
  | "json"
  | "parquet"
  | "google-sheets"
  | "rest-api"
  | "postgres"
  | "mysql"
  | "cloud-storage"
  | "warehouse"
  | "other";

export type DataSourceExecution = "browser" | "server" | "remote";
export type DataSourceStatus = "pending" | "ready" | "needs-relink" | "error";

export interface DataSourceDescriptor {
  id: string;
  projectId: string;
  kind: DataSourceKind;
  name: string;
  status: DataSourceStatus;
  execution: DataSourceExecution;
  /** Non-secret metadata only. Credentials belong in a secret store, never here. */
  config: Record<string, string | number | boolean | null>;
  /** Browser-local file metadata; the file itself is not serialized into this manifest. */
  file?: {
    fileName: string;
    fileSize: number;
    lastModified?: number;
  };
  assets: Array<{
    id: string;
    name: string;
    assetType: "table" | "sheet" | "file" | "endpoint" | "other";
    columns?: string[];
  }>;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface MizyaProject {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  schemaVersion: typeof MIZYA_PROJECT_SCHEMA_VERSION;
  sourceIds: string[];
}

export interface MizyaWorkspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  projectIds: string[];
}

export interface ProjectManifest {
  schemaVersion: typeof MIZYA_PROJECT_SCHEMA_VERSION;
  project: MizyaProject;
  sources: DataSourceDescriptor[];
}

export interface ProjectRepository {
  listProjects(workspaceId: string): Promise<MizyaProject[]>;
  getProject(projectId: string): Promise<ProjectManifest | null>;
  saveProject(manifest: ProjectManifest): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
}

export function createId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${random}`;
}

export function createProject(
  workspaceId: string,
  name: string,
  description = "",
  now = Date.now(),
): MizyaProject {
  const normalizedName = name.trim();
  if (!workspaceId.trim()) throw new Error("workspace-id-required");
  if (!normalizedName) throw new Error("project-name-required");
  return {
    id: createId("prj"),
    workspaceId,
    name: normalizedName,
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    schemaVersion: MIZYA_PROJECT_SCHEMA_VERSION,
    sourceIds: [],
  };
}

export function createDataSource(
  projectId: string,
  input: {
    kind: DataSourceKind;
    name: string;
    execution?: DataSourceExecution;
    config?: Record<string, string | number | boolean | null>;
    file?: DataSourceDescriptor["file"];
    assets?: DataSourceDescriptor["assets"];
  },
  now = Date.now(),
): DataSourceDescriptor {
  if (!projectId.trim()) throw new Error("project-id-required");
  if (!input.name.trim()) throw new Error("source-name-required");
  return {
    id: createId("src"),
    projectId,
    kind: input.kind,
    name: input.name.trim(),
    status: input.file ? "needs-relink" : "pending",
    execution: input.execution ?? "browser",
    config: { ...(input.config ?? {}) },
    ...(input.file ? { file: { ...input.file } } : {}),
    assets: (input.assets ?? []).map((asset) => ({ ...asset })),
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function createProjectManifest(
  project: MizyaProject,
  sources: DataSourceDescriptor[] = [],
): ProjectManifest {
  const ids = new Set<string>();
  for (const source of sources) {
    if (source.projectId !== project.id) throw new Error("source-project-mismatch");
    if (ids.has(source.id)) throw new Error("duplicate-source-id");
    ids.add(source.id);
  }
  return {
    schemaVersion: MIZYA_PROJECT_SCHEMA_VERSION,
    project: { ...project, sourceIds: sources.map((source) => source.id) },
    sources: sources.map((source) => ({
      ...source,
      config: { ...source.config },
      assets: source.assets.map((asset) => ({ ...asset })),
      ...(source.file ? { file: { ...source.file } } : {}),
    })),
  };
}

const SOURCE_KINDS: DataSourceKind[] = [
  "csv", "xlsx", "json", "parquet", "google-sheets", "rest-api",
  "postgres", "mysql", "cloud-storage", "warehouse", "other",
];
const SOURCE_STATUSES: DataSourceStatus[] = ["pending", "ready", "needs-relink", "error"];
const SOURCE_EXECUTIONS: DataSourceExecution[] = ["browser", "server", "remote"];
const ASSET_TYPES = ["table", "sheet", "file", "endpoint", "other"] as const;
const SENSITIVE_CONFIG_KEY = /(password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)/i;

export function validateProjectManifest(value: unknown): value is ProjectManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const manifest = value as Partial<ProjectManifest>;
  if (manifest.schemaVersion !== MIZYA_PROJECT_SCHEMA_VERSION) return false;
  const project = manifest.project;
  if (!project || typeof project.id !== "string" || !project.id ||
      typeof project.workspaceId !== "string" || !project.workspaceId ||
      typeof project.name !== "string" || !project.name.trim() ||
      typeof project.description !== "string" ||
      !Number.isFinite(project.createdAt) || !Number.isFinite(project.updatedAt) ||
      !(project.archivedAt === null || Number.isFinite(project.archivedAt)) ||
      project.schemaVersion !== MIZYA_PROJECT_SCHEMA_VERSION ||
      !Array.isArray(project.sourceIds) ||
      !project.sourceIds.every((id) => typeof id === "string" && id.length > 0)) return false;
  if (!Array.isArray(manifest.sources)) return false;

  const ids = new Set<string>();
  for (const source of manifest.sources) {
    if (!source || typeof source !== "object" ||
        typeof source.id !== "string" || !source.id ||
        source.projectId !== project.id ||
        typeof source.name !== "string" || !source.name.trim() ||
        !SOURCE_KINDS.includes(source.kind) ||
        !SOURCE_STATUSES.includes(source.status) ||
        !SOURCE_EXECUTIONS.includes(source.execution) ||
        !source.config || typeof source.config !== "object" || Array.isArray(source.config) ||
        Object.keys(source.config).some((key) => SENSITIVE_CONFIG_KEY.test(key)) ||
        !Array.isArray(source.assets) ||
        !Number.isFinite(source.createdAt) || !Number.isFinite(source.updatedAt) ||
        !Number.isFinite(source.schemaVersion)) return false;
    if (ids.has(source.id)) return false;
    ids.add(source.id);

    if (source.file && (typeof source.file.fileName !== "string" ||
        !Number.isFinite(source.file.fileSize) || source.file.fileSize < 0)) return false;
    for (const asset of source.assets) {
      if (!asset || typeof asset.id !== "string" || !asset.id ||
          typeof asset.name !== "string" || !asset.name ||
          !(ASSET_TYPES as readonly string[]).includes(asset.assetType) ||
          (asset.columns !== undefined &&
            (!Array.isArray(asset.columns) || !asset.columns.every((column) => typeof column === "string")))) {
        return false;
      }
    }
  }
  return project.sourceIds.length === ids.size && project.sourceIds.every((id) => ids.has(id));
}
