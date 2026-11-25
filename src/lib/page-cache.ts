/** Maximum number of virtualized page slices retained by DataTable. */
export const MAX_DATA_TABLE_PAGE_CACHE_ENTRIES = 40;

/**
 * Insert a page slice and evict the oldest insertion when the cache exceeds
 * its fixed bound. Dataset changes still clear the entire cache in DataTable.
 */
export function setBoundedPageCacheEntry<T>(
  cache: Map<string, T>,
  key: string,
  value: T,
  maxEntries = MAX_DATA_TABLE_PAGE_CACHE_ENTRIES,
): void {
  cache.set(key, value);
  while (cache.size > Math.max(0, maxEntries)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}
