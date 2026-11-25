export interface DatasetViewCacheIdentity {
  fileName: string;
  sheet: string;
  contentFingerprint: string | null;
  relationRevision: number;
}

/** Stable cache namespace for a rendered dataset view, including actual data/relation identity. */
export function buildDatasetViewCacheKey(identity: DatasetViewCacheIdentity): string {
  return JSON.stringify([
    identity.fileName,
    identity.sheet,
    identity.contentFingerprint,
    identity.relationRevision,
  ]);
}
